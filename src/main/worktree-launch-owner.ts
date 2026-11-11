import type { WorktreeMeta } from '../shared/worktree/meta-types'
import type { Repo } from '../shared/repo-types'
import { splitWorktreeId } from '../shared/worktree/id'
import { normalizeRuntimePathForComparison } from '../shared/cross-platform-path'
import { projectAgentAccountId, type WorktreeAccountAgent } from '../shared/worktree-agent-account'

export type PinnedMeta = Pick<WorktreeMeta, 'agentAccountId'>

export type LaunchOwnerRepo = Pick<
  Repo,
  'id' | 'path' | 'claudeAccountId' | 'codexAccountId' | 'connectionId'
>

export type WorktreeAccountMetaSource = {
  getWorktreeMeta: (worktreeId: string) => PinnedMeta | undefined
  getAllWorktreeMeta: () => Record<string, PinnedMeta>
  /** Project defaults apply when the launch's worktree pins nothing; absent = worktree pins only. */
  getRepos?: () => readonly LaunchOwnerRepo[]
}

export type WorktreeLaunchLocation = { worktreeId?: string; workspacePath?: string }

function comparablePath(path: string): string {
  // Why: separators are folded so Windows and WSL UNC spellings compare like POSIX ones.
  return normalizeRuntimePathForComparison(path).replace(/\\/g, '/')
}

function isSameOrDescendantPath(candidate: string, root: string): boolean {
  return candidate === root || candidate.startsWith(root.endsWith('/') ? root : `${root}/`)
}

/** The deepest worktree containing `cwd`, among those `include` accepts. */
function deepestWorktreeForPath(
  source: WorktreeAccountMetaSource,
  cwd: string,
  include: (meta: PinnedMeta) => boolean
): { worktreeId: string; meta: PinnedMeta } | null {
  let best: { worktreeId: string; meta: PinnedMeta; length: number } | null = null
  for (const [worktreeId, meta] of Object.entries(source.getAllWorktreeMeta())) {
    if (!include(meta)) {
      continue
    }
    const parsed = splitWorktreeId(worktreeId)
    if (!parsed) {
      continue
    }
    const root = comparablePath(parsed.worktreePath)
    if (isSameOrDescendantPath(cwd, root) && (!best || root.length > best.length)) {
      best = { worktreeId, meta, length: root.length }
    }
  }
  return best ? { worktreeId: best.worktreeId, meta: best.meta } : null
}

function findLaunchRepo(
  source: WorktreeAccountMetaSource,
  launch: WorktreeLaunchLocation,
  cwd: string | null
): LaunchOwnerRepo | null {
  // Why local only: SSH projects launch on their remote host, which owns its own accounts.
  const repos = (source.getRepos?.() ?? []).filter((repo) => !repo.connectionId)
  if (repos.length === 0) {
    return null
  }
  const explicitRepoId = launch.worktreeId ? splitWorktreeId(launch.worktreeId)?.repoId : undefined
  if (explicitRepoId) {
    return repos.find((repo) => repo.id === explicitRepoId) ?? null
  }
  if (!cwd) {
    return null
  }
  const owningRepoId = deepestWorktreeForPath(source, cwd, () => true)?.worktreeId
  const repoId = owningRepoId ? splitWorktreeId(owningRepoId)?.repoId : undefined
  if (repoId) {
    return repos.find((repo) => repo.id === repoId) ?? null
  }
  let best: { repo: LaunchOwnerRepo; length: number } | null = null
  for (const repo of repos) {
    const root = comparablePath(repo.path)
    if (isSameOrDescendantPath(cwd, root) && (!best || root.length > best.length)) {
      best = { repo, length: root.length }
    }
  }
  return best?.repo ?? null
}

/** The worktree pin of a launch: the explicit id, else the deepest pinned worktree containing the cwd. */
export function findLaunchWorktree(
  source: WorktreeAccountMetaSource,
  launch: WorktreeLaunchLocation
): { worktreeId: string; meta: PinnedMeta } | null {
  const cwd = launch.workspacePath ? comparablePath(launch.workspacePath) : null
  if (launch.worktreeId) {
    const meta = source.getWorktreeMeta(launch.worktreeId)
    return meta?.agentAccountId ? { worktreeId: launch.worktreeId, meta } : null
  }
  return cwd ? deepestWorktreeForPath(source, cwd, (meta) => Boolean(meta.agentAccountId)) : null
}

export type LaunchAccountCandidate = { worktreeId: string; accountId: string }

/**
 * Accounts a launch of `agent` may use, most specific first: the worktree's pin, then the
 * project's default for that agent. Callers take the first one that belongs to `agent`,
 * so a worktree pinned to a Claude account still gets the project's Codex default.
 */
export function findLaunchAccountCandidates(
  source: WorktreeAccountMetaSource,
  launch: WorktreeLaunchLocation,
  agent: WorktreeAccountAgent
): LaunchAccountCandidate[] {
  const candidates: LaunchAccountCandidate[] = []
  const pinned = findLaunchWorktree(source, launch)
  if (pinned?.meta.agentAccountId) {
    candidates.push({ worktreeId: pinned.worktreeId, accountId: pinned.meta.agentAccountId })
  }
  const cwd = launch.workspacePath ? comparablePath(launch.workspacePath) : null
  const repo = findLaunchRepo(source, launch, cwd)
  const projectAccountId = projectAgentAccountId(repo, agent)
  if (repo && projectAccountId) {
    candidates.push({ worktreeId: launch.worktreeId ?? repo.id, accountId: projectAccountId })
  }
  return candidates
}
