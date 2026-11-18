import type {
  RuntimeWorktreePsConditionalResult,
  RuntimeWorktreePsResult
} from '../../../shared/runtime-types'
import { contentSnapshotId } from './content-snapshot-id'

// Why: home, the host screen and other phones each poll their own base; 16 covers them without holding rows.
const RECENT_SNAPSHOT_LIMIT = 16

// Row hashes only, never row content: eviction costs one full reply, never correctness.
const recentRowHashes = new Map<string, readonly string[]>()

function identify(result: RuntimeWorktreePsResult): { snapshotId: string; rowHashes: string[] } {
  const rowHashes = result.worktrees.map((row) => contentSnapshotId(JSON.stringify(row)))
  const snapshotId = contentSnapshotId(JSON.stringify({ ...result, worktrees: rowHashes }))
  return { snapshotId, rowHashes }
}

function remember(snapshotId: string, rowHashes: readonly string[]): void {
  // Delete before set so the entry moves to the newest LRU position.
  recentRowHashes.delete(snapshotId)
  recentRowHashes.set(snapshotId, rowHashes)
  if (recentRowHashes.size > RECENT_SNAPSHOT_LIMIT) {
    const oldest = recentRowHashes.keys().next().value
    if (oldest !== undefined) {
      recentRowHashes.delete(oldest)
    }
  }
}

function rowsFromBase(
  result: RuntimeWorktreePsResult,
  rowHashes: readonly string[],
  baseRowHashes: readonly string[]
): (number | RuntimeWorktreePsResult['worktrees'][number])[] {
  const baseIndexByHash = new Map<string, number>()
  baseRowHashes.forEach((hash, index) => {
    if (!baseIndexByHash.has(hash)) {
      baseIndexByHash.set(hash, index)
    }
  })
  return result.worktrees.map((row, index) => baseIndexByHash.get(rowHashes[index] ?? '') ?? row)
}

// Why: content-addressed like an HTTP ETag, so snapshot ownership lives entirely in the
// id. Any number of concurrent clients, any `limit`, and any runtime restart stay correct
// by construction: ids match only when the catalogs are byte-identical, which is exactly
// when `unchanged` is the right answer. Row deltas are opt-in and fall back to the full
// catalog when the caller's base was evicted.
export function resolveWorktreeCatalogSnapshot(
  result: RuntimeWorktreePsResult,
  afterSnapshotId: string | null,
  options?: { acceptRowDelta?: boolean }
): RuntimeWorktreePsConditionalResult {
  const { snapshotId, rowHashes } = identify(result)
  const baseRowHashes =
    options?.acceptRowDelta === true && afterSnapshotId !== null
      ? recentRowHashes.get(afterSnapshotId)
      : undefined
  remember(snapshotId, rowHashes)
  if (afterSnapshotId === snapshotId) {
    return { unchanged: true, snapshotId }
  }
  if (afterSnapshotId !== null && baseRowHashes) {
    const { worktrees: _worktrees, ...envelope } = result
    return {
      ...envelope,
      snapshotId,
      baseSnapshotId: afterSnapshotId,
      rowsFromBase: rowsFromBase(result, rowHashes, baseRowHashes)
    }
  }
  return { ...result, snapshotId }
}
