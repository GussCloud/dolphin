import { createHash } from 'node:crypto'

// Why: 192 bits of a sha256 over the serialized reply. Accidental collision is
// impossible at any realistic poll rate, and this is not an auth boundary.
const SNAPSHOT_ID_LENGTH = 32

/** A content-derived reply id: equal serializations get equal ids across clients and restarts. */
export function contentSnapshotId(serialized: string): string {
  return createHash('sha256').update(serialized).digest('base64url').slice(0, SNAPSHOT_ID_LENGTH)
}

/** The reply, or `unchanged` when the caller already holds this exact content; the plain reply when it sent no id. */
export function resolveReplySnapshot<Reply extends object>(
  reply: Reply,
  afterSnapshotId: string | null | undefined
): Reply | (Reply & { snapshotId: string }) | { unchanged: true; snapshotId: string } {
  if (afterSnapshotId === undefined) {
    return reply
  }
  const snapshotId = contentSnapshotId(JSON.stringify(reply))
  return afterSnapshotId === snapshotId ? { unchanged: true, snapshotId } : { ...reply, snapshotId }
}
