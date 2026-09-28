import { basename, join, resolve } from 'node:path'
import { isPathInsideOrEqual } from '../../shared/cross-platform-path'
import { getProjectGroupSubtreeIds } from '../../shared/project-groups'
import type { ProjectGroup } from '../../shared/project-group-types'
import { isGitRepoKind } from '../../shared/repo-kind'
import type { Repo } from '../../shared/repo-types'

export type MultiProjectWorkspaceMemberPlan = {
  repo: Repo
  worktreePath: string
}

export type MultiProjectWorkspacePlan = {
  group: ProjectGroup
  containerPath: string
  members: MultiProjectWorkspaceMemberPlan[]
}

export class MultiProjectWorkspacePlanError extends Error {}

type PlanInput = {
  projectGroupId: string
  containerName: string
  repoIds: readonly string[]
  projectGroups: readonly ProjectGroup[]
  repos: readonly Repo[]
  /** Where this repo's worktrees would be created by default. */
  resolveWorkspaceRoot: (repo: Repo) => string
  /** True when the repo can't take a caller-chosen worktree path (custom base path, WSL mirror). */
  hasPinnedWorktreeLocation: (repo: Repo) => boolean
  sanitizeName: (name: string) => string
  isCaseInsensitiveFs: boolean
}

/**
 * Validates a multi-project create and lays it out as `<workspace root>/<name>/<project>`, so the
 * container sits beside ordinary worktrees and every member passes the workspace-root guard.
 */
export function planMultiProjectWorkspace(input: PlanInput): MultiProjectWorkspacePlan {
  const group = input.projectGroups.find((entry) => entry.id === input.projectGroupId)
  if (!group) {
    throw new MultiProjectWorkspacePlanError('Project group not found.')
  }
  const uniqueRepoIds = [...new Set(input.repoIds)]
  if (uniqueRepoIds.length === 0) {
    throw new MultiProjectWorkspacePlanError('Select at least one project.')
  }
  const groupIds = getProjectGroupSubtreeIds(input.projectGroups, group.id)
  const repoById = new Map(input.repos.map((repo) => [repo.id, repo]))
  const repos = uniqueRepoIds.map((repoId) => {
    const repo = repoById.get(repoId)
    // Why: same membership rule as the composer's folder sources — grouped, or inside the group folder.
    const inGroup =
      repo !== undefined &&
      ((typeof repo.projectGroupId === 'string' && groupIds.has(repo.projectGroupId)) ||
        (group.parentPath !== null && isPathInsideOrEqual(group.parentPath, repo.path)))
    if (!repo || !inGroup) {
      throw new MultiProjectWorkspacePlanError(`Project ${repoId} is not in "${group.name}".`)
    }
    if (!isGitRepoKind(repo)) {
      throw new MultiProjectWorkspacePlanError(`"${repo.displayName}" is not a Git repository.`)
    }
    // Why: v1 creates every member through the local create path; SSH/runtime hosts need their own placement.
    if (repo.connectionId || (repo.executionHostId && repo.executionHostId !== 'local')) {
      throw new MultiProjectWorkspacePlanError(
        `"${repo.displayName}" is on a remote host. Multi-project workspaces support local projects only.`
      )
    }
    if (input.hasPinnedWorktreeLocation(repo)) {
      throw new MultiProjectWorkspacePlanError(
        `"${repo.displayName}" uses a custom worktree location, so it can't join a multi-project workspace.`
      )
    }
    return repo
  })

  const rootKey = (path: string): string => {
    const resolved = resolve(path)
    return input.isCaseInsensitiveFs ? resolved.toLowerCase() : resolved
  }
  const workspaceRoot = input.resolveWorkspaceRoot(repos[0])
  for (const repo of repos.slice(1)) {
    if (rootKey(input.resolveWorkspaceRoot(repo)) !== rootKey(workspaceRoot)) {
      throw new MultiProjectWorkspacePlanError(
        `"${repo.displayName}" creates worktrees in a different folder than "${repos[0].displayName}".`
      )
    }
  }

  const containerPath = join(workspaceRoot, input.sanitizeName(input.containerName))
  const dirKey = (name: string): string => (input.isCaseInsensitiveFs ? name.toLowerCase() : name)
  const usedDirNames = new Set<string>()
  const members = repos.map((repo) => {
    const baseDirName = input.sanitizeName(
      basename(repo.path).replace(/\.git$/, '') || repo.displayName
    )
    let dirName = baseDirName
    for (let suffix = 2; usedDirNames.has(dirKey(dirName)); suffix += 1) {
      dirName = `${baseDirName}-${suffix}`
    }
    usedDirNames.add(dirKey(dirName))
    return { repo, worktreePath: join(containerPath, dirName) }
  })
  return { group, containerPath, members }
}
