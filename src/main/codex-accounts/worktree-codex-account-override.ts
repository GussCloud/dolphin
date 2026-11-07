import type { GlobalSettings } from '../../shared/global-settings-types'
import type { CodexManagedAccount } from '../../shared/managed-account-types'
import type { WorktreeMeta } from '../../shared/worktree/meta-types'
import { splitWorktreeId } from '../../shared/worktree/id'
import { normalizeRuntimePathForComparison } from '../../shared/cross-platform-path'
import { resolveWorktreeAgentAccount } from '../../shared/worktree-agent-account'
import {
  getSelectedCodexAccountIdForTarget,
  type CodexAccountSelectionTarget
} from './runtime-selection'

export type WorktreeAccountMetaSource = {
  getWorktreeMeta: (worktreeId: string) => WorktreeMeta | undefined
  getAllWorktreeMeta: () => Record<string, WorktreeMeta>
}

export type CodexLaunchAccountOverride =
  | { kind: 'none' }
  | { kind: 'override'; account: CodexManagedAccount; worktreeId: string }
  | { kind: 'unavailable'; accountId: string; worktreeId: string; reason: string }

function isSameOrDescendantPath(candidate: string, root: string): boolean {
  return candidate === root || candidate.startsWith(root.endsWith('/') ? root : `${root}/`)
}

/** The worktree owning a launch: the explicit id, else the deepest worktree containing the cwd. */
function findLaunchWorktree(
  source: WorktreeAccountMetaSource,
  launch: { worktreeId?: string; workspacePath?: string }
): { worktreeId: string; meta: WorktreeMeta } | null {
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
  let best: { worktreeId: string; meta: WorktreeMeta; length: number } | null = null
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

/**
 * Which Codex account a launch must use because its worktree pinned one.
 * `none` means the global selection (today's behavior, including a pin equal to it).
 */
export function resolveCodexLaunchAccountOverride(args: {
  source: WorktreeAccountMetaSource | null | undefined
  settings: GlobalSettings | undefined
  target?: CodexAccountSelectionTarget
  worktreeId?: string
  workspacePath?: string
}): CodexLaunchAccountOverride {
  if (!args.source || !args.settings) {
    return { kind: 'none' }
  }
  const owner = findLaunchWorktree(args.source, args)
  if (!owner?.meta.agentAccountId) {
    return { kind: 'none' }
  }
  const resolution = resolveWorktreeAgentAccount({
    agentAccountId: owner.meta.agentAccountId,
    agent: 'codex',
    target: args.target,
    settings: args.settings
  })
  if (resolution.kind === 'global') {
    return { kind: 'none' }
  }
  if (resolution.kind === 'unavailable') {
    return {
      kind: 'unavailable',
      accountId: resolution.accountId,
      worktreeId: owner.worktreeId,
      reason: resolution.reason
    }
  }
  if (getSelectedCodexAccountIdForTarget(args.settings, args.target) === resolution.accountId) {
    return { kind: 'none' }
  }
  const account = args.settings.codexManagedAccounts.find(
    (entry) => entry.id === resolution.accountId
  )
  return account ? { kind: 'override', account, worktreeId: owner.worktreeId } : { kind: 'none' }
}
