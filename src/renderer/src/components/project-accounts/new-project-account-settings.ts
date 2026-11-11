import { useCallback, useState } from 'react'
import type { Repo } from '../../../../shared/repo-types'
import type { RepoAccountBinding } from '../../../../shared/source-control-account-types'
import {
  EMPTY_COMMIT_IDENTITY_DRAFT,
  evaluateCommitIdentityDraft,
  type CommitIdentityDraft
} from './commit-identity-draft'
import type { ProjectAccountSelection } from './project-account-options'
import type { ProjectStartAccounts } from './project-start-accounts'

/** Only non-default choices; an empty object reproduces today's add flow exactly. */
export type NewProjectAccountSettings = RepoAccountBinding

export type NewProjectAccountDraft = {
  selection: ProjectAccountSelection | null
  identity: CommitIdentityDraft
}

export const EMPTY_NEW_PROJECT_ACCOUNT_DRAFT: NewProjectAccountDraft = {
  selection: null,
  identity: EMPTY_COMMIT_IDENTITY_DRAFT
}

/** Null while the commit author is half-filled or malformed, so the add action stays disabled. */
export function resolveNewProjectAccountSettings(
  draft: NewProjectAccountDraft
): NewProjectAccountSettings | null {
  const identity = evaluateCommitIdentityDraft(draft.identity)
  if (identity.status === 'incomplete' || identity.status === 'invalid') {
    return null
  }
  const settings: NewProjectAccountSettings = {}
  if (identity.status === 'valid') {
    settings.commitIdentity = identity.identity
  }
  if (draft.selection?.provider === 'github' && draft.selection.ghAccount) {
    settings.ghAccount = draft.selection.ghAccount
  }
  if (draft.selection?.provider === 'azure-devops' && draft.selection.azureDevOpsAccountId) {
    settings.azureDevOpsAccountId = draft.selection.azureDevOpsAccountId
  }
  return settings
}

/** Spread into add/clone/create args; omits the key for the defaults so older hosts see today's call. */
export function accountBindingArg(settings: NewProjectAccountSettings): {
  accountBinding?: NewProjectAccountSettings
} {
  return Object.keys(settings).length > 0 ? { accountBinding: settings } : {}
}

/** False when the host returned the repo without the requested fields (older host ignores the param). */
export function isAccountBindingEchoed(repo: Repo, settings: NewProjectAccountSettings): boolean {
  const ghOk =
    !settings.ghAccount ||
    (repo.ghAccount?.host.toLowerCase() === settings.ghAccount.host.toLowerCase() &&
      repo.ghAccount?.user.toLowerCase() === settings.ghAccount.user.toLowerCase())
  const azureOk =
    !settings.azureDevOpsAccountId || repo.azureDevOpsAccountId === settings.azureDevOpsAccountId
  const identityOk =
    !settings.commitIdentity ||
    (repo.commitIdentity?.name === settings.commitIdentity.name &&
      repo.commitIdentity?.email === settings.commitIdentity.email)
  const agentOk =
    (!settings.claudeAccountId || repo.claudeAccountId === settings.claudeAccountId) &&
    (!settings.codexAccountId || repo.codexAccountId === settings.codexAccountId)
  return ghOk && azureOk && identityOk && agentOk
}

/** The clone form's draft plus the first-screen picks it preselects from. */
export type CloneProjectAccounts = ReturnType<typeof useNewProjectAccountDraft> & {
  preferred: ProjectStartAccounts | null
}

export function useNewProjectAccountDraft(): {
  draft: NewProjectAccountDraft
  setSelection: (selection: ProjectAccountSelection | null) => void
  setIdentity: (identity: CommitIdentityDraft) => void
  /** Sets the author only while the form's author is still empty. */
  seedIdentity: (identity: CommitIdentityDraft) => void
  reset: () => void
} {
  const [draft, setDraft] = useState<NewProjectAccountDraft>(EMPTY_NEW_PROJECT_ACCOUNT_DRAFT)
  const setSelection = useCallback(
    (selection: ProjectAccountSelection | null) => setDraft((prev) => ({ ...prev, selection })),
    []
  )
  const setIdentity = useCallback(
    (identity: CommitIdentityDraft) => setDraft((prev) => ({ ...prev, identity })),
    []
  )
  const seedIdentity = useCallback(
    (identity: CommitIdentityDraft) =>
      setDraft((prev) =>
        evaluateCommitIdentityDraft(prev.identity).status === 'empty' ? { ...prev, identity } : prev
      ),
    []
  )
  const reset = useCallback(() => setDraft(EMPTY_NEW_PROJECT_ACCOUNT_DRAFT), [])
  return { draft, setSelection, setIdentity, seedIdentity, reset }
}
