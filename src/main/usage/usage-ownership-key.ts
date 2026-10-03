// Cross-file ownership keys for usage scans (Claude dedupe keys, Codex event keys).
// Why compact: a key is kept for every counted turn of every transcript on disk, held in
// main's memory, re-sent to the scan worker on every scan and re-serialized into the cache.
// Raw keys are 50-100+ chars; a 96-bit digest is 16 and collision-free at any realistic
// corpus size. Keys cannot be dropped by age instead: resuming an old session copies its
// turns into a new file, and only the old file's keys stop them being counted twice.
import { createHash } from 'node:crypto'

const COMPACT_KEY_LENGTH = 16
// Raw keys always contain ':' or '|', which base64url never emits, so the two never collide.
const COMPACT_KEY_PATTERN = /^[A-Za-z0-9_-]{16}$/

export function isCompactUsageOwnershipKey(key: string): boolean {
  return COMPACT_KEY_PATTERN.test(key)
}

/** Idempotent: an already-compact key is returned unchanged. */
export function toUsageOwnershipKey(sourceKey: string): string {
  if (isCompactUsageOwnershipKey(sourceKey)) {
    return sourceKey
  }
  return createHash('sha256').update(sourceKey).digest('base64url').slice(0, COMPACT_KEY_LENGTH)
}

/**
 * Migrates a cached file's keys written before compaction; null when they are already
 * compact. One scan wrote every key of a file, so checking the first one is enough.
 */
export function compactLegacyUsageOwnershipKeys(keys: readonly string[]): string[] | null {
  if (keys.length === 0 || isCompactUsageOwnershipKey(keys[0])) {
    return null
  }
  return [...new Set(keys.map(toUsageOwnershipKey))]
}
