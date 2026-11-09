import type { GhAccountBinding } from '../../../../shared/github/account-binding'
import type { Repo } from '../../../../shared/repo-types'
import type { CommitIdentity } from '../../../../shared/source-control-account-types'
import { projectRemoteTargetFromIdentityKey } from '../project-accounts/project-account-provider'
import { RepositoryGitHubAccountSection } from './RepositoryGitHubAccountSection'
import { RepositoryAccountIdentitySection } from './RepositoryAccountIdentitySection'

type RepositoryAccountSectionsProps = {
  repo: Repo
  updateRepo: (
    repoId: string,
    updates: {
      ghAccount?: GhAccountBinding | null
      azureDevOpsAccountId?: string | null
      commitIdentity?: CommitIdentity | null
    }
  ) => unknown
  forceVisible?: boolean
}

/** Picks the provider's account control for the repo's remote, plus the commit author editor. */
export function RepositoryAccountSections({
  repo,
  updateRepo,
  forceVisible
}: RepositoryAccountSectionsProps): React.JSX.Element {
  const azureDevOpsRemote =
    projectRemoteTargetFromIdentityKey(repo.gitRemoteIdentity?.canonicalKey)?.provider ===
    'azure-devops'
  // Why: SSH projects run git on the remote; per-project identity is not applied there yet.
  const remoteSsh = Boolean(repo.connectionId)
  return (
    <>
      {/* Why: non-Azure remotes keep the GitHub section, which already handles GHES hosts and unbound repos. */}
      {azureDevOpsRemote ? null : (
        <RepositoryGitHubAccountSection
          repo={repo}
          updateRepo={updateRepo}
          forceVisible={forceVisible}
        />
      )}
      {remoteSsh ? null : (
        <RepositoryAccountIdentitySection
          key={repo.id}
          repo={repo}
          azureDevOpsRemote={azureDevOpsRemote}
          updateRepo={updateRepo}
          forceVisible={forceVisible}
        />
      )}
    </>
  )
}
