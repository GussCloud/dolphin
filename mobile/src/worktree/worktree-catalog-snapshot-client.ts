import { z } from 'zod'
import type { RpcClient } from '../transport/rpc-client'
import type { RpcFailure } from '../transport/types'
import type { Worktree } from './workspace-list-sections'
import { worktreeCatalogRead } from './worktree-catalog-operations'

// Why: worktree.ps silently truncates at 200; use a high cap so large hosts don't drop workspaces.
export const WORKTREE_PS_FULL_LIMIT = 10_000

export type WorktreeCatalogAdmission<T> =
  | { kind: 'full'; snapshotId: string | null; worktrees: T[] }
  | { kind: 'unchanged'; snapshotId: string }
  // Entries are rows, or indexes into the catalog the caller holds under baseSnapshotId.
  | { kind: 'delta'; snapshotId: string; baseSnapshotId: string; rowsFromBase: (number | T)[] }
  | { kind: 'invalid' }

export type PendingWorktreeCatalog = {
  admission: WorktreeCatalogAdmission<Worktree>
  client: RpcClient
  hostId: string
  requestedSnapshotId: string | null
}

// Why (STA-3123): a failed worktree.ps must stay distinguishable from an empty
// catalog — collapsing both to "no rows" made unreachable remote-server catalogs
// render as a healthy host with 0 worktrees.
export type WorktreeCatalogFetchResult =
  | { kind: 'response'; pending: PendingWorktreeCatalog }
  | { kind: 'request_failed'; code: string }

const snapshotIdSchema = z.string().min(1).max(128)

// Rows stay opaque, as consumers validate their own projections; malformed fields read as absent.
const catalogReplySchema = z.looseObject({
  worktrees: z.array(z.custom<Worktree>()).optional().catch(undefined),
  snapshotId: snapshotIdSchema.optional().catch(undefined),
  unchanged: z.boolean().optional().catch(undefined),
  baseSnapshotId: snapshotIdSchema.optional().catch(undefined),
  rowsFromBase: z
    .array(z.union([z.number(), z.custom<Worktree>()]))
    .optional()
    .catch(undefined)
})

export function admitWorktreeCatalogResponse(
  result: unknown,
  requestedSnapshotId: string | null
): WorktreeCatalogAdmission<Worktree> {
  const parsed = catalogReplySchema.safeParse(result)
  if (!parsed.success) {
    return { kind: 'invalid' }
  }
  const { worktrees, unchanged, baseSnapshotId, rowsFromBase } = parsed.data
  const snapshotId = parsed.data.snapshotId ?? null
  // Why: a full response is defined by carrying rows, so discriminate on that rather
  // than on the presence of `unchanged` — the latter could collide with a future
  // catalog field and silently reclassify a full response.
  if (worktrees) {
    return { kind: 'full', snapshotId, worktrees }
  }
  if (unchanged === true && snapshotId && snapshotId === requestedSnapshotId) {
    return { kind: 'unchanged', snapshotId }
  }
  if (
    snapshotId &&
    requestedSnapshotId !== null &&
    baseSnapshotId === requestedSnapshotId &&
    rowsFromBase
  ) {
    return { kind: 'delta', snapshotId, baseSnapshotId, rowsFromBase }
  }
  return { kind: 'invalid' }
}

export class WorktreeCatalogSnapshotClient {
  private client: RpcClient | null = null
  private hostId: string | null = null
  private snapshotId: string | null = null
  private confirmedWorktrees: Worktree[] | null = null

  async fetch(client: RpcClient, hostId: string): Promise<WorktreeCatalogFetchResult> {
    if (this.client !== client || this.hostId !== hostId) {
      this.client = client
      this.hostId = hostId
      this.snapshotId = null
      this.confirmedWorktrees = null
    }
    const requestedSnapshotId = this.snapshotId
    const reply = await worktreeCatalogRead.request(client, {
      limit: WORKTREE_PS_FULL_LIMIT,
      afterSnapshotId: requestedSnapshotId,
      acceptRowDelta: true
    })
    const catalog = worktreeCatalogRead.interpret(reply)
    if (!catalog.accepted) {
      // The refusal code the caller reports lives on the envelope; no acceptance policy carries it.
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: this policy skips only a refusal, so an unaccepted reply is a failure envelope.
      const code = (reply as RpcFailure).error?.code
      return {
        kind: 'request_failed',
        code: typeof code === 'string' && code.length > 0 ? code : 'request_failed'
      }
    }
    return {
      kind: 'response',
      pending: {
        admission: admitWorktreeCatalogResponse(catalog.value, requestedSnapshotId),
        client,
        hostId,
        requestedSnapshotId
      }
    }
  }

  /** The confirmed host catalog to apply, or null when there is nothing to apply. */
  admit(pending: PendingWorktreeCatalog | null): Worktree[] | null {
    if (!pending) {
      return null
    }
    // Why: a response from a superseded client/host is stale, not wrong — dropping it
    // must not invalidate the token the current client/host just established.
    if (pending.client !== this.client || pending.hostId !== this.hostId) {
      return null
    }
    // Why: a late unchanged or delta reply answers a token this client no longer holds; its base is gone.
    if (pending.admission.kind !== 'full' && pending.requestedSnapshotId !== this.snapshotId) {
      return null
    }
    if (pending.admission.kind === 'invalid') {
      this.snapshotId = null
      return null
    }

    const { admission } = pending
    if (admission.kind === 'delta') {
      const rebuilt = this.confirmedWorktrees
        ? rebuildFromBase(admission.rowsFromBase, this.confirmedWorktrees)
        : null
      if (!rebuilt) {
        // The next poll asks for a full catalog.
        this.snapshotId = null
        return null
      }
      this.confirmedWorktrees = rebuilt
    } else if (admission.kind === 'full') {
      this.confirmedWorktrees = admission.worktrees
    }
    this.snapshotId = admission.snapshotId
    // Why: unchanged responses still return the confirmed rows so every poll reasserts
    // host truth over optimistic local edits, exactly as the full-payload path did. A copy,
    // because the next delta indexes into these rows and a caller may sort in place.
    return this.confirmedWorktrees ? [...this.confirmedWorktrees] : null
  }
}

// Null when an index falls outside the base; the caller then asks for a full catalog.
function rebuildFromBase(rowsFromBase: (number | Worktree)[], base: Worktree[]): Worktree[] | null {
  const rows: Worktree[] = []
  for (const entry of rowsFromBase) {
    if (typeof entry !== 'number') {
      if (!entry || typeof entry !== 'object') {
        return null
      }
      rows.push(entry)
      continue
    }
    const row = Number.isInteger(entry) ? base[entry] : undefined
    if (!row) {
      return null
    }
    rows.push(row)
  }
  return rows
}
