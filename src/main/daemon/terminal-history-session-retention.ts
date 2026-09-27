import { lstat, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  StorageGcCandidate,
  StorageGcKeepReason,
  StorageGcPolicy
} from '../../shared/storage-gc-types'
import { TERMINAL_HISTORY_SESSION_FILE_NAMES } from './terminal-history-session-files'
import { readTerminalHistoryMetaFromDir } from './terminal-history-metadata'
import { isTerminalHistorySessionDirRecoveryProtected } from './terminal-history-recovery-quarantine'

const DAY_MS = 24 * 60 * 60 * 1000
export const DEFAULT_STORAGE_GC_POLICY: StorageGcPolicy = {
  maxAgeMs: 30 * DAY_MS,
  maxTotalBytes: 5 * 1024 * 1024 * 1024
}
// Why a floor under any policy: a tree touched this recently may belong to a spawn racing the scan.
export const STORAGE_GC_MIN_IDLE_MS = DAY_MS

export type TerminalHistorySessionTree = StorageGcCandidate & {
  recoveryProtected: boolean
}

/**
 * Lists daemon session trees. Per-worktree shell HISTFILE directories share the root but hold none
 * of the session files, so they are skipped here (terminal-history-gc.ts owns those).
 */
export async function scanTerminalHistorySessionTrees(
  basePath: string
): Promise<TerminalHistorySessionTree[]> {
  let names: string[]
  try {
    names = await readdir(basePath)
  } catch {
    return []
  }
  const trees: TerminalHistorySessionTree[] = []
  for (const name of names) {
    // Why: dot entries are the tombstone queue and the recovery quarantine, never sessions.
    if (name.startsWith('.')) {
      continue
    }
    const tree = await readSessionTree(join(basePath, name), name)
    if (tree) {
      trees.push(tree)
    }
  }
  return trees
}

async function readSessionTree(
  dir: string,
  name: string
): Promise<TerminalHistorySessionTree | null> {
  let sessionId: string
  try {
    sessionId = decodeURIComponent(name)
  } catch {
    return null
  }
  let bytes = 0
  let lastActivityAt = 0
  let sessionFiles = 0
  for (const file of TERMINAL_HISTORY_SESSION_FILE_NAMES) {
    try {
      const stats = await lstat(join(dir, file))
      if (stats.isFile()) {
        sessionFiles += 1
        bytes += stats.size
        lastActivityAt = Math.max(lastActivityAt, stats.mtimeMs)
      }
    } catch {
      // Absent file: sessions write these lazily.
    }
  }
  if (sessionFiles === 0) {
    return null
  }
  const endedAt = Date.parse(readTerminalHistoryMetaFromDir(dir)?.endedAt ?? '')
  if (Number.isFinite(endedAt)) {
    lastActivityAt = Math.max(lastActivityAt, endedAt)
  }
  return {
    sessionId,
    bytes,
    lastActivityAt,
    recoveryProtected: isTerminalHistorySessionDirRecoveryProtected(dir)
  }
}

export type TerminalHistoryGcPlan = {
  remove: StorageGcCandidate[]
  keptByReason: Partial<Record<StorageGcKeepReason, number>>
  totalBytes: number
}

/** Pure: which trees a policy removes, given everything that still owns one. */
export function planTerminalHistoryGc(args: {
  trees: readonly TerminalHistorySessionTree[]
  policy: StorageGcPolicy
  now: number
  liveSessionIds: ReadonlySet<string>
  referencedSessionIds: ReadonlySet<string>
}): TerminalHistoryGcPlan {
  const keptByReason: Partial<Record<StorageGcKeepReason, number>> = {}
  const keep = (reason: StorageGcKeepReason): void => {
    keptByReason[reason] = (keptByReason[reason] ?? 0) + 1
  }
  const eligible: TerminalHistorySessionTree[] = []
  let totalBytes = 0
  for (const tree of args.trees) {
    totalBytes += tree.bytes
    if (args.liveSessionIds.has(tree.sessionId)) {
      keep('live-in-daemon')
    } else if (args.referencedSessionIds.has(tree.sessionId)) {
      keep('referenced-by-saved-tab')
    } else if (tree.recoveryProtected) {
      keep('recovery-protected')
    } else if (args.now - tree.lastActivityAt < STORAGE_GC_MIN_IDLE_MS) {
      keep('recently-active')
    } else {
      eligible.push(tree)
    }
  }

  const remove: StorageGcCandidate[] = []
  let remainingBytes = totalBytes
  // Oldest first, so a size pass evicts the stalest history before anything newer.
  eligible.sort((a, b) => a.lastActivityAt - b.lastActivityAt)
  for (const tree of eligible) {
    const expired = args.now - tree.lastActivityAt >= args.policy.maxAgeMs
    if (expired || remainingBytes > args.policy.maxTotalBytes) {
      remove.push({
        sessionId: tree.sessionId,
        bytes: tree.bytes,
        lastActivityAt: tree.lastActivityAt
      })
      remainingBytes -= tree.bytes
    } else {
      keep('within-policy')
    }
  }
  return { remove, keptByReason, totalBytes }
}

/** Every string anywhere in `value` (as a value or a key) that `isSessionId` accepts. */
export function collectReferencedSessionIds(
  value: unknown,
  isSessionId: ReadonlySet<string> | ((candidate: string) => boolean)
): Set<string> {
  const matches =
    typeof isSessionId === 'function' ? isSessionId : (c: string) => isSessionId.has(c)
  const found = new Set<string>()
  const stack: unknown[] = [value]
  while (stack.length > 0) {
    const current = stack.pop()
    if (typeof current === 'string') {
      if (matches(current)) {
        found.add(current)
      }
    } else if (Array.isArray(current)) {
      stack.push(...current)
    } else if (current && typeof current === 'object') {
      // Why keys too: some maps are keyed by pty id (e.g. per-leaf bindings).
      for (const [key, child] of Object.entries(current)) {
        if (matches(key)) {
          found.add(key)
        }
        stack.push(child)
      }
    }
  }
  return found
}
