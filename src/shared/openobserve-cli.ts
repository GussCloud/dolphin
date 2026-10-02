// OpenObserve CLI (openobserve-cli) domain: what the host's CLI reports about its
// install, contexts, sign-in and companion agent skill. Credentials stay in the CLI's
// own OS keychain store; Dolphin only writes credential-free context presets.

export const OPENOBSERVE_CLI_COMMAND = 'openobserve-cli'

export const OPENOBSERVE_CLI_NPM_PACKAGE = '@angelmsger/openobserve-cli'

export const OPENOBSERVE_CLI_INSTALL_COMMAND = `npm install -g ${OPENOBSERVE_CLI_NPM_PACKAGE}`

export const OPENOBSERVE_SKILL_NAME = 'openobserve'

export const OPENOBSERVE_SKILL_INSTALL_COMMAND = `${OPENOBSERVE_CLI_COMMAND} skill install`

export const OPENOBSERVE_CLI_REPOSITORY_URL = 'https://github.com/AngelMsger/openobserve-cli'

export const OPENOBSERVE_CLI_INSTALL_DOCS_URL = `${OPENOBSERVE_CLI_REPOSITORY_URL}/blob/main/docs/installation.md`

export const OPENOBSERVE_SERVICE_ACCOUNT_DOCS_URL =
  'https://openobserve.ai/docs/user-guide/account-administration/identity-and-access-management/service-accounts/'

// `session` is the browser sign-in the CLI uses for SSO instances.
export type OpenObserveAuthScheme = 'basic' | 'token' | 'session'

export const OPENOBSERVE_AUTH_SCHEMES: readonly OpenObserveAuthScheme[] = [
  'basic',
  'token',
  'session'
]

export function isOpenObserveAuthScheme(value: unknown): value is OpenObserveAuthScheme {
  return value === 'basic' || value === 'token' || value === 'session'
}

export type OpenObserveContext = {
  name: string
  baseUrl: string | null
  org: string | null
  current: boolean
}

export type OpenObserveSkillStatus = {
  // Agents whose skills directory holds the companion skill, e.g. `claude-code`.
  installedAgents: string[]
  // Agents whose installed copy is older than the skill embedded in this CLI.
  outdatedAgents: string[]
}

export type OpenObserveCliStatus =
  | { installed: false }
  | {
      installed: true
      version: string | null
      contexts: OpenObserveContext[]
      activeContext: string | null
      baseUrl: string | null
      org: string | null
      authScheme: OpenObserveAuthScheme | null
      authenticated: boolean
      username: string | null
      // The CLI's own explanation when it is not authenticated.
      authError: string | null
      // Null when `skill status` could not be read.
      skill: OpenObserveSkillStatus | null
    }

export type OpenObserveSaveContextInput = {
  name: string
  baseUrl: string
  org: string
  authScheme: OpenObserveAuthScheme
}

export type OpenObserveCommandResult = { ok: true } | { ok: false; error: string }

const CONTEXT_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/
const ORG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/

export function isValidOpenObserveContextName(value: string): boolean {
  return CONTEXT_NAME_PATTERN.test(value)
}

export function isValidOpenObserveOrg(value: string): boolean {
  return ORG_PATTERN.test(value)
}

// Accepts `o2.example.com` or a full http(s) URL; returns the origin+path the CLI
// expects, without a trailing slash, or null when unusable.
export function normalizeOpenObserveBaseUrl(value: string): string | null {
  const trimmed = value.trim().replace(/\/+$/, '')
  if (!trimmed || /\s/.test(trimmed)) {
    return null
  }
  if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
    return null
  }
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
    if (!url.hostname || url.username || url.password || url.search || url.hash) {
      return null
    }
    return `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, '')}`
  } catch {
    return null
  }
}

/** Validates a context preset; returns the normalized input or the field that failed. */
export function parseOpenObserveSaveContextInput(
  input: OpenObserveSaveContextInput
):
  | { ok: true; value: OpenObserveSaveContextInput }
  | { ok: false; field: 'name' | 'baseUrl' | 'org' | 'authScheme' } {
  const name = input.name.trim()
  if (!isValidOpenObserveContextName(name)) {
    return { ok: false, field: 'name' }
  }
  const baseUrl = normalizeOpenObserveBaseUrl(input.baseUrl)
  if (!baseUrl) {
    return { ok: false, field: 'baseUrl' }
  }
  const org = input.org.trim()
  if (!isValidOpenObserveOrg(org)) {
    return { ok: false, field: 'org' }
  }
  if (!isOpenObserveAuthScheme(input.authScheme)) {
    return { ok: false, field: 'authScheme' }
  }
  return {
    ok: true,
    value: { name, baseUrl, org, authScheme: input.authScheme }
  }
}

export function openObserveSignInCommand(scheme: OpenObserveAuthScheme | null): string {
  return scheme === 'session'
    ? `${OPENOBSERVE_CLI_COMMAND} auth login --browser`
    : `${OPENOBSERVE_CLI_COMMAND} auth login`
}
