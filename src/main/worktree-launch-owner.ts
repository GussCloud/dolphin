import type { WorktreeMeta } from '../shared/worktree/meta-types'
import { splitWorktreeId } from '../shared/worktree/id'
import { normalizeRuntimePathForComparison } from '../shared/cross-platform-path'

export type PinnedMeta = Pick<WorktreeMeta, 'agentAccountId'>

export type WorktreeAccountMetaSource = {
  getWorktreeMeta: (worktreeId: string) => PinnedMeta | undefined
  getAllWorktreeMeta: () => Record<string, PinnedMeta>
}

export type WorktreeLaunchLocation = { worktreeId?: string; workspacePath?: string }

function isSameOrDescendantPath(candidate: string, root: string): boolean {
  return candidate === root || candidate.startsWith(root.endsWith('/') ? root : `${root}/`)
}

/** The worktree owning a launch: the explicit id, else the deepest pinned worktree containing the cwd. */
export function findLaunchWorktree(
  source: WorktreeAccountMetaSource,
  launch: WorktreeLaunchLocation
): { worktreeId: string; meta: PinnedMeta } | null {
  if (launch.worktreeId) {
    const meta = source.getWorktreeMeta(launch.worktreeId)
    return meta ? { worktreeId: launch.worktreeId, meta } : null
  }
  if (!launch.workspacePath) {
    return null
  }
  // Why: structured and local-provider launches carry only a cwd; separators are folded so
  // Windows and WSL UNC spellings compare like POSIX ones.
  const cwd = normalizeRuntimePathForComparison(launch.workspacePath).replace(/\\/g, '/')
  let best: { worktreeId: string; meta: PinnedMeta; length: number } | null = null
  for (const [worktreeId, meta] of Object.entries(source.getAllWorktreeMeta())) {
    if (!meta.agentAccountId) {
      continue
    }
    const parsed = splitWorktreeId(worktreeId)
    if (!parsed) {
      continue
    }
    const root = normalizeRuntimePathForComparison(parsed.worktreePath).replace(/\\/g, '/')
    if (isSameOrDescendantPath(cwd, root) && (!best || root.length > best.length)) {
      best = { worktreeId, meta, length: root.length }
    }
  }
  return best ? { worktreeId: best.worktreeId, meta: best.meta } : null
}
