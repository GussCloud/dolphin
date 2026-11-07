/**
 * Git credential helper config scoped to concrete https hosts: an empty `credential.<url>.helper`
 * clears every helper configured so far (global osxkeychain/GCM included) for that URL only, then
 * Dolphin's helper answers `get` from env vars set on that one git child.
 *
 * Git 2.25 (the baseline) matches `credential.<url>` by exact, case-sensitive host and has no host
 * wildcards (2.26), so every key is a concrete host in each spelling a remote actually uses.
 */

export type GitCredentialGrant =
  | { kind: 'token'; urls: readonly string[]; username: string; token: string }
  /** Fail closed for these URLs with `message`, instead of falling back to the global helper. */
  | { kind: 'unavailable'; urls: readonly string[]; message: string }

export const AZURE_DEVOPS_CLOUD_GIT_URL = 'https://dev.azure.com'

/** `git config --get-regexp` pattern for every remote URL and every URL rewrite rule. */
export const GIT_REMOTE_URL_CONFIG_PATTERN =
  '^(remote\\..*\\.(url|pushurl)|url\\..*\\.(insteadof|pushinsteadof))$'

const VISUALSTUDIO_HOST_RE = /^[a-z0-9][a-z0-9-]*\.visualstudio\.com$/
// Why not `new URL`: it lowercases the host, and 2.25 compares hosts case-sensitively.
const HTTPS_AUTHORITY_RE = /^https:\/\/(?:[^@/?#]*@)?([^/:?#]+)(:\d+)?(?:[/?#]|$)/i

/**
 * URLs a call can reach, from `git config --get-regexp GIT_REMOTE_URL_CONFIG_PATTERN` output:
 * each remote URL plus each rewrite base. A base is a superset of what `insteadOf` can produce,
 * which keeps this to one config read without re-implementing git's rewrite matching.
 */
export function remoteUrlCandidatesFromGitConfig(stdout: string): string[] {
  const candidates: string[] = []
  for (const line of stdout.split(/\r?\n/)) {
    const space = line.indexOf(' ')
    if (space === -1) {
      continue
    }
    const key = line.slice(0, space)
    const rewrite = /^url\.(.+)\.(?:insteadof|pushinsteadof)$/i.exec(key)
    candidates.push(rewrite ? rewrite[1] : line.slice(space + 1))
  }
  return candidates
}

/** `https://<host[:port]>` keys for each candidate host `matches` accepts, as spelled and lowercased. */
function credentialUrlsFor(
  candidates: readonly string[],
  matches: (authority: string) => boolean,
  always: readonly string[]
): string[] {
  const urls = new Set(always)
  for (const candidate of candidates) {
    const match = HTTPS_AUTHORITY_RE.exec(candidate.trim())
    if (!match) {
      continue
    }
    const authority = `${match[1]}${match[2] ?? ''}`
    if (matches(authority.toLowerCase())) {
      urls.add(`https://${authority}`)
      urls.add(`https://${authority.toLowerCase()}`)
    }
  }
  return [...urls]
}

/** dev.azure.com plus each concrete visualstudio.com host the call can reach; never a wildcard. */
export function azureDevOpsGitUrls(candidates: readonly string[]): string[] {
  return credentialUrlsFor(
    candidates,
    (authority) =>
      authority === 'dev.azure.com' || VISUALSTUDIO_HOST_RE.test(authority.replace(/:\d+$/, '')),
    [AZURE_DEVOPS_CLOUD_GIT_URL]
  )
}

/** The bound GitHub host plus each differently cased spelling of it the call can reach. */
export function githubGitUrls(bindingHost: string, candidates: readonly string[]): string[] {
  const host = bindingHost.trim().toLowerCase()
  return credentialUrlsFor(candidates, (authority) => authority === host, [`https://${host}`])
}

function isSafeHelperValue(value: string): boolean {
  // Why: credential-protocol lines are newline-delimited; a newline would forge attributes.
  return value.length > 0 && !/[\r\n\0]/.test(value)
}

function credentialHelperSnippet(slot: number, grant: GitCredentialGrant): string {
  const prefix = `DOLPHIN_GIT_CREDENTIAL_${slot}`
  // Why: answer only `get`; `store`/`erase` stay no-ops so the token never reaches a keychain.
  const body =
    grant.kind === 'token'
      ? `printf 'username=%s\\npassword=%s\\n' "$${prefix}_USERNAME" "$${prefix}_PASSWORD"`
      : `printf '%s\\n' "$${prefix}_ERROR" >&2; echo quit=1`
  return `!f() { test "$1" = get || exit 0; ${body}; }; f`
}

function grantEnv(slot: number, grant: GitCredentialGrant): Record<string, string> {
  const prefix = `DOLPHIN_GIT_CREDENTIAL_${slot}`
  if (
    grant.kind === 'token' &&
    isSafeHelperValue(grant.token) &&
    isSafeHelperValue(grant.username)
  ) {
    return { [`${prefix}_USERNAME`]: grant.username, [`${prefix}_PASSWORD`]: grant.token }
  }
  const message =
    grant.kind === 'unavailable' ? grant.message : 'Dolphin could not use the project account.'
  return { [`${prefix}_ERROR`]: message.replace(/[\r\n\0]+/g, ' ') }
}

/** Leading `-c` args (reset, then helper, per URL) and the env vars those helpers read. */
export function buildScopedCredentialHelperConfig(grants: readonly GitCredentialGrant[]): {
  leadingArgs: string[]
  env: Record<string, string>
} {
  const leadingArgs: string[] = []
  const env: Record<string, string> = {}
  grants.forEach((grant, slot) => {
    const malformedToken =
      grant.kind === 'token' &&
      !(isSafeHelperValue(grant.token) && isSafeHelperValue(grant.username))
    const effective: GitCredentialGrant = malformedToken
      ? { kind: 'unavailable', urls: grant.urls, message: 'Dolphin got an invalid credential.' }
      : grant
    for (const url of effective.urls) {
      leadingArgs.push(
        '-c',
        `credential.${url}.helper=`,
        '-c',
        `credential.${url}.helper=${credentialHelperSnippet(slot, effective)}`
      )
    }
    Object.assign(env, grantEnv(slot, effective))
  })
  return { leadingArgs, env }
}
