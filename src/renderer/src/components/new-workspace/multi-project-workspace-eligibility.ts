import { getRepoExecutionHostId, LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host'
import type { ProjectGroup } from '../../../../shared/project-group-types'
import type { Repo } from '../../../../shared/repo-types'

/**
 * Projects that can each get a worktree in a multi-project workspace. The host places members
 * with local git, so only local groups qualify; folder sources already share the group's host.
 */
export function getMultiProjectEligibleRepos(
  projectGroup: ProjectGroup | null,
  folderSourceRepos: readonly Repo[]
): Repo[] {
  if (!projectGroup || getRepoExecutionHostId(projectGroup) !== LOCAL_EXECUTION_HOST_ID) {
    return []
  }
  return folderSourceRepos.filter(
    (repo) => getRepoExecutionHostId(repo) === LOCAL_EXECUTION_HOST_ID
  )
}
