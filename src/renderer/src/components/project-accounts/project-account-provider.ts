import { normalizeGitRemoteUrl, splitGitRemoteKey } from '../../../../shared/git-remote-identity'

/** Providers whose per-project account Dolphin can bind; everything else keeps today's ambient login. */
export type ProjectAccountProvider = 'github' | 'azure-devops'

export type ProjectRemoteTarget = {
  provider: ProjectAccountProvider
  host: string
}

function isAzureDevOpsHost(host: string): boolean {
  return (
    host === 'dev.azure.com' || host === 'ssh.dev.azure.com' || host.endsWith('.visualstudio.com')
  )
}

function isGitHubCloudHost(host: string): boolean {
  return host === 'github.com' || host === 'ssh.github.com' || host.endsWith('.ghe.com')
}

function targetForHost(
  host: string,
  knownGitHubHosts: readonly string[]
): ProjectRemoteTarget | null {
  if (isAzureDevOpsHost(host)) {
    return { provider: 'azure-devops', host: 'dev.azure.com' }
  }
  if (isGitHubCloudHost(host)) {
    return { provider: 'github', host: host === 'ssh.github.com' ? 'github.com' : host }
  }
  // Why: GitHub Enterprise Server hosts are only recognizable by gh already having a login for them.
  if (knownGitHubHosts.some((known) => known.toLowerCase() === host)) {
    return { provider: 'github', host }
  }
  return null
}

/** Classifies a clone URL (https, ssh or scp form). Null for unsupported providers or unparsable input. */
export function projectRemoteTargetFromUrl(
  remoteUrl: string,
  knownGitHubHosts: readonly string[] = []
): ProjectRemoteTarget | null {
  const key = normalizeGitRemoteUrl(remoteUrl)
  return projectRemoteTargetFromIdentityKey(key, knownGitHubHosts)
}

/** Classifies a registered repo's `gitRemoteIdentity.canonicalKey`. */
export function projectRemoteTargetFromIdentityKey(
  canonicalKey: string | null | undefined,
  knownGitHubHosts: readonly string[] = []
): ProjectRemoteTarget | null {
  const parts = splitGitRemoteKey(canonicalKey, (host) => host)
  return parts ? targetForHost(parts.host, knownGitHubHosts) : null
}
