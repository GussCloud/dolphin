import { getRepoExecutionHostId, LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host'
import { isGitRepoKind } from '../../../../shared/repo-kind'
import type { Repo } from '../../../../shared/repo-types'

/**
 * Whether a project can get a worktree in a multi-project workspace. The host places members with
 * local git at the shared worktree root, so remote projects and custom worktree locations can't.
 */
export function isMultiProjectEligibleRepo(repo: Repo): boolean {
  return (
    isGitRepoKind(repo) &&
    !repo.connectionId &&
    getRepoExecutionHostId(repo) === LOCAL_EXECUTION_HOST_ID &&
    !repo.worktreeBasePath?.trim()
  )
}

/**
 * The projects a composer submit turns into one worktree each: the primary project followed by
 * the added ones. Null when fewer than two eligible projects remain, so the composer falls back to
 * an ordinary single-project create.
 */
export function resolveMultiProjectMemberRepoIds(args: {
  primaryRepoId: string | null
  extraRepoIds: readonly string[]
  repos: readonly Repo[]
}): string[] | null {
  const repoById = new Map(args.repos.map((repo) => [repo.id, repo]))
  const primary = args.primaryRepoId ? repoById.get(args.primaryRepoId) : undefined
  if (!primary || !isMultiProjectEligibleRepo(primary)) {
    return null
  }
  const memberIds = [primary.id]
  for (const repoId of args.extraRepoIds) {
    const repo = repoById.get(repoId)
    if (repo && isMultiProjectEligibleRepo(repo) && !memberIds.includes(repo.id)) {
      memberIds.push(repo.id)
    }
  }
  return memberIds.length > 1 ? memberIds : null
}
