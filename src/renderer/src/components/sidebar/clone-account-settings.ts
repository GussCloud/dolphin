import {
  resolveNewProjectAccountSettings,
  type NewProjectAccountDraft
} from '../project-accounts/new-project-account-settings'
import {
  projectStartBinding,
  startAgentAccounts,
  type ProjectStartAccounts
} from '../project-accounts/project-start-accounts'
import { projectRemoteTargetFromUrl } from '../project-accounts/project-account-provider'
import type { RepoAccountBinding } from '../../../../shared/source-control-account-types'
import { parseWslUncPath } from '../../../../shared/wsl-paths'

/**
 * The binding a clone request carries. On this PC the accounts panel decides it, matched to the
 * URL's provider and host; a WSL destination or a remote host uses the per-remote form instead,
 * because its gh logins are not the ones the panel lists. Null while that form is invalid.
 */
export function cloneAccountSettings(
  url: string,
  destination: string,
  startAccounts: ProjectStartAccounts | undefined,
  formDraft: NewProjectAccountDraft
): RepoAccountBinding | null {
  if (startAccounts && !parseWslUncPath(destination)) {
    const knownHosts = startAccounts.ghAccount ? [startAccounts.ghAccount.host] : []
    return projectStartBinding(startAccounts, projectRemoteTargetFromUrl(url, knownHosts))
  }
  const fromForm = resolveNewProjectAccountSettings(formDraft)
  return fromForm ? { ...fromForm, ...startAgentAccounts(startAccounts) } : null
}
