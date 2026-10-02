import type { OpenObserveCliStatus } from '../../../../shared/openobserve-cli'

export type OpenObserveCardState =
  | 'checking'
  | 'unavailable'
  | 'not-installed'
  | 'not-configured'
  | 'not-authenticated'
  | 'connected'

/** Setup step the OpenObserve card shows next, derived from the host's CLI status. */
export function deriveOpenObserveCardState(
  status: OpenObserveCliStatus | null,
  loadFailed: boolean
): OpenObserveCardState {
  if (!status) {
    // Why: a remote host that predates the integration rejects the RPC method.
    return loadFailed ? 'unavailable' : 'checking'
  }
  if (!status.installed) {
    return 'not-installed'
  }
  if (!status.activeContext || !status.baseUrl) {
    return 'not-configured'
  }
  return status.authenticated ? 'connected' : 'not-authenticated'
}

export type OpenObserveSkillState = 'unknown' | 'not-installed' | 'outdated' | 'installed'

export function deriveOpenObserveSkillState(
  status: OpenObserveCliStatus | null
): OpenObserveSkillState {
  const skill = status?.installed ? status.skill : null
  if (!skill) {
    return 'unknown'
  }
  if (skill.installedAgents.length === 0) {
    return 'not-installed'
  }
  return skill.outdatedAgents.length > 0 ? 'outdated' : 'installed'
}
