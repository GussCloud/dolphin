import { basename, join, resolve } from 'node:path'
import { isGitRepoKind } from '../../../../shared/repo-kind'
import type { Repo } from '../../../../shared/repo-types'

export type MultiProjectWorkspaceMemberPlan = {
  repo: Repo
  worktreePath: string
}

export type MultiProjectWorkspacePlan = {
  containerPath: string
  members: MultiProjectWorkspaceMemberPlan[]
}

export class MultiProjectWorkspacePlanError extends Error {}

type PlacementRules = {
  repos: readonly Repo[]
  /** Where this repo's worktrees would be created by default. */
  resolveWorkspaceRoot: (repo: Repo) => string
  /** True when the repo can't take a caller-chosen worktree path (custom base path, WSL mirror). */
  hasPinnedWorktreeLocation: (repo: Repo) => boolean
  sanitizeName: (name: string) => string
  isCaseInsensitiveFs: boolean
}

type PlanInput = PlacementRules & {
  containerName: string
  repoIds: readonly string[]
}

type MemberAdditionInput = PlacementRules & {
  containerPath: string
  repoId: string
  /** Repos already in the workspace, keyed by id, with the folder each one occupies. */
  existingMembers: readonly { repoId: string; worktreePath: string }[]
}

/**
 * Validates a multi-project create and lays it out as `<workspace root>/<name>/<project>`, so the
 * container sits beside ordinary worktrees and every member passes the workspace-root guard.
 */
export function planMultiProjectWorkspace(input: PlanInput): MultiProjectWorkspacePlan {
  const uniqueRepoIds = [...new Set(input.repoIds)]
  if (uniqueRepoIds.length === 0) {
    throw new MultiProjectWorkspacePlanError('Select at least one project.')
  }
  const repos = uniqueRepoIds.map((repoId) => resolveEligibleRepo(input, repoId))
  const workspaceRoot = input.resolveWorkspaceRoot(repos[0])
  for (const repo of repos.slice(1)) {
    assertSharedWorkspaceRoot(input, repo, workspaceRoot, `"${repos[0].displayName}"`)
  }
  const containerPath = join(workspaceRoot, input.sanitizeName(input.containerName))
  const usedDirNames = new Set<string>()
  const members = repos.map((repo) => ({
    repo,
    worktreePath: join(containerPath, allocateMemberDirName(input, repo, usedDirNames))
  }))
  return { containerPath, members }
}

/** Validates adding one more project to an existing multi-project workspace. */
export function planMultiProjectMemberAddition(
  input: MemberAdditionInput
): MultiProjectWorkspaceMemberPlan {
  if (input.existingMembers.some((member) => member.repoId === input.repoId)) {
    throw new MultiProjectWorkspacePlanError('This project is already in the workspace.')
  }
  const repo = resolveEligibleRepo(input, input.repoId)
  // Why: the container lives in the members' shared workspace root, so its parent is that root.
  const workspaceRoot = resolve(input.containerPath, '..')
  assertSharedWorkspaceRoot(input, repo, workspaceRoot, 'this workspace')
  const usedDirNames = new Set(
    input.existingMembers.map((member) => dirKey(input, basename(member.worktreePath)))
  )
  return {
    repo,
    worktreePath: join(input.containerPath, allocateMemberDirName(input, repo, usedDirNames))
  }
}

function resolveEligibleRepo(rules: PlacementRules, repoId: string): Repo {
  const repo = rules.repos.find((entry) => entry.id === repoId)
  if (!repo) {
    throw new MultiProjectWorkspacePlanError(`Project ${repoId} was not found.`)
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
  if (rules.hasPinnedWorktreeLocation(repo)) {
    throw new MultiProjectWorkspacePlanError(
      `"${repo.displayName}" uses a custom worktree location, so it can't join a multi-project workspace.`
    )
  }
  return repo
}

function assertSharedWorkspaceRoot(
  rules: PlacementRules,
  repo: Repo,
  workspaceRoot: string,
  /** Already quoted when it names a project. */
  otherDescription: string
): void {
  const rootKey = (path: string): string => dirKey(rules, resolve(path))
  if (rootKey(rules.resolveWorkspaceRoot(repo)) !== rootKey(workspaceRoot)) {
    throw new MultiProjectWorkspacePlanError(
      `"${repo.displayName}" creates worktrees in a different folder than ${otherDescription}.`
    )
  }
}

function allocateMemberDirName(
  rules: PlacementRules,
  repo: Repo,
  usedDirNames: Set<string>
): string {
  const baseDirName = rules.sanitizeName(
    basename(repo.path).replace(/\.git$/, '') || repo.displayName
  )
  let dirName = baseDirName
  for (let suffix = 2; usedDirNames.has(dirKey(rules, dirName)); suffix += 1) {
    dirName = `${baseDirName}-${suffix}`
  }
  usedDirNames.add(dirKey(rules, dirName))
  return dirName
}

function dirKey(rules: Pick<PlacementRules, 'isCaseInsensitiveFs'>, name: string): string {
  return rules.isCaseInsensitiveFs ? name.toLowerCase() : name
}
