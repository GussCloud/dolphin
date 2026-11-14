import type { Repo } from './repo-types'
import { getRepoExecutionHostId, LOCAL_EXECUTION_HOST_ID } from './execution-host'

/**
 * A project added before per-project accounts existed: local, never reviewed, and with no
 * account of its own. Projects added since are marked reviewed at creation.
 */
export function needsProjectAccountSetup(repo: Repo): boolean {
  if (typeof repo.accountSetupReviewedAt === 'number') {
    return false
  }
  // Why local only: an SSH or server project's agents run with that host's accounts.
  if (repo.connectionId || getRepoExecutionHostId(repo) !== LOCAL_EXECUTION_HOST_ID) {
    return false
  }
  return !(
    repo.ghAccount ||
    repo.azureDevOpsAccountId ||
    repo.commitIdentity ||
    repo.claudeAccountId ||
    repo.codexAccountId
  )
}
