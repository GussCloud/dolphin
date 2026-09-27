import type {
  StorageGcCandidate,
  StorageGcPolicy,
  StorageGcResult
} from '../../shared/storage-gc-types'
import {
  collectReferencedSessionIds,
  planTerminalHistoryGc,
  scanTerminalHistorySessionTrees
} from './terminal-history-session-retention'

export type TerminalHistoryGcDeps = {
  basePath: string
  /** Null when no daemon provider exists; incomplete when any adapter failed to answer. */
  listDaemonSessions: () => Promise<{
    sessions: { sessionId: string; isAlive: boolean }[]
    complete: boolean
  } | null>
  /** Every persisted workspace session, walked for ids a saved tab could still restore. */
  readPersistedWorkspaceSessions: () => unknown[]
  removeSessionTree: (sessionId: string) => Promise<void>
  now?: () => number
}

export async function runTerminalHistoryGc(
  deps: TerminalHistoryGcDeps,
  options: { policy: StorageGcPolicy; dryRun: boolean }
): Promise<StorageGcResult> {
  const now = deps.now?.() ?? Date.now()
  const [trees, inventory] = await Promise.all([
    scanTerminalHistorySessionTrees(deps.basePath),
    deps.listDaemonSessions().catch(() => null)
  ])
  const knownIds = new Set(trees.map((tree) => tree.sessionId))
  const referenced = collectReferencedSessionIds(deps.readPersistedWorkspaceSessions(), knownIds)
  const plan = planTerminalHistoryGc({
    trees,
    policy: options.policy,
    now,
    liveSessionIds: new Set(
      (inventory?.sessions ?? []).filter((s) => s.isAlive).map((s) => s.sessionId)
    ),
    referencedSessionIds: referenced
  })
  // Why refuse: without every daemon's answer, a tree may belong to a session that is still live.
  const refused = !inventory?.complete
  const result: StorageGcResult = {
    dryRun: options.dryRun,
    policy: options.policy,
    scannedSessionCount: trees.length,
    totalBytes: plan.totalBytes,
    removed: plan.remove,
    reclaimableBytes: plan.remove.reduce((sum, c) => sum + c.bytes, 0),
    keptByReason: plan.keptByReason,
    ...(refused ? { refusedReason: 'daemon-inventory-incomplete' as const } : {})
  }
  if (options.dryRun || refused) {
    return result
  }
  const removed: StorageGcCandidate[] = []
  for (const candidate of plan.remove) {
    try {
      await deps.removeSessionTree(candidate.sessionId)
      removed.push(candidate)
    } catch (error) {
      console.warn('[storage-gc] failed to remove terminal history', candidate.sessionId, error)
    }
  }
  return {
    ...result,
    removed,
    reclaimableBytes: removed.reduce((sum, c) => sum + c.bytes, 0)
  }
}
