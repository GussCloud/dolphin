import type { GhAccountBinding } from '../../../../shared/github/account-binding'
import type { Repo } from '../../../../shared/repo-types'
import type { CommitIdentity } from '../../../../shared/source-control-account-types'

/** Repo fields the settings pane writes; null clears the account and identity bindings. */
export type RepositoryPaneRepoUpdate = Omit<
  Partial<Repo>,
  | 'sourceControlAi'
  | 'externalWorktreeVisibility'
  | 'ghAccount'
  | 'azureDevOpsAccountId'
  | 'commitIdentity'
  | 'claudeAccountId'
  | 'codexAccountId'
> & {
  sourceControlAi?: Repo['sourceControlAi'] | null
  externalWorktreeVisibility?: Repo['externalWorktreeVisibility'] | null
  ghAccount?: GhAccountBinding | null
  azureDevOpsAccountId?: string | null
  commitIdentity?: CommitIdentity | null
  claudeAccountId?: string | null
  codexAccountId?: string | null
}
