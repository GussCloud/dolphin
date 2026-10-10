import type { ManagedPaneInternal } from './pane-manager-types'
import { disposeWebgl } from './pane-webgl-renderer'

// Dolphin raises Blink's active-context ceiling to 128, but retained contexts
// still consume GPU memory. Six keeps recent switch-backs on WebGL without
// letting hidden worktrees grow that cost with the mounted-pane population.
const MAX_RETAINED_HIDDEN_WEBGL_CONTEXTS = 6
// Why: each retained context holds ~30-40 MB of GPU-process memory that no renderer counter
// sees. Instant switch-back matters for recent worktrees; past ten minutes hidden, reveal
// reattaches exactly as after an over-cap eviction.
export const RETAINED_HIDDEN_WEBGL_EXPIRY_MS = 10 * 60_000

/** Identity of the surface whose hidden panes are retained; compared by reference only. */
export type HiddenWebglRetentionOwner = WeakKey

type RetainedHiddenEntry = {
  owner: HiddenWebglRetentionOwner
  livePanes: () => Iterable<ManagedPaneInternal>
  expiryTimer: ReturnType<typeof setTimeout> | null
}

// LRU: oldest suspend first.
const retainedEntries: RetainedHiddenEntry[] = []

function liveContextCount(entry: RetainedHiddenEntry): number {
  let count = 0
  for (const pane of entry.livePanes()) {
    if (pane.webglAddon) {
      count += 1
    }
  }
  return count
}

function disposeEntryContexts(entry: RetainedHiddenEntry): void {
  for (const pane of entry.livePanes()) {
    disposeWebgl(pane)
  }
}

function clearExpiry(entry: RetainedHiddenEntry): void {
  if (entry.expiryTimer !== null) {
    clearTimeout(entry.expiryTimer)
    entry.expiryTimer = null
  }
}

function removeEntry(owner: HiddenWebglRetentionOwner): void {
  const index = retainedEntries.findIndex((entry) => entry.owner === owner)
  if (index !== -1) {
    clearExpiry(retainedEntries[index]!)
    retainedEntries.splice(index, 1)
  }
}

function expireEntry(entry: RetainedHiddenEntry): void {
  entry.expiryTimer = null
  const index = retainedEntries.indexOf(entry)
  if (index === -1) {
    return
  }
  retainedEntries.splice(index, 1)
  disposeEntryContexts(entry)
}

/**
 * Try to keep the owner's live WebGL addons across a hide. Returns true when
 * retained — the caller must then skip its dispose pass. Evicts (disposes)
 * least-recently-hidden owners to stay under the context cap.
 */
export function tryRetainHiddenPanesWebgl(
  owner: HiddenWebglRetentionOwner,
  livePanes: () => Iterable<ManagedPaneInternal>
): boolean {
  removeEntry(owner)
  const entry: RetainedHiddenEntry = { owner, livePanes, expiryTimer: null }
  const ownCount = liveContextCount(entry)
  // Nothing to retain (GPU off / first-mount hidden), or a single tab too wide
  // for the cap — normal dispose keeps eviction from thrashing every other tab.
  if (ownCount === 0 || ownCount > MAX_RETAINED_HIDDEN_WEBGL_CONTEXTS) {
    return false
  }
  let total = ownCount
  for (const other of retainedEntries) {
    total += liveContextCount(other)
  }
  while (total > MAX_RETAINED_HIDDEN_WEBGL_CONTEXTS && retainedEntries.length > 0) {
    const evicted = retainedEntries.shift()!
    clearExpiry(evicted)
    total -= liveContextCount(evicted)
    disposeEntryContexts(evicted)
  }
  entry.expiryTimer = setTimeout(() => expireEntry(entry), RETAINED_HIDDEN_WEBGL_EXPIRY_MS)
  retainedEntries.push(entry)
  return true
}

/** Drop retention bookkeeping on reveal/destroy; never disposes live addons. */
export function releaseHiddenWebglRetention(owner: HiddenWebglRetentionOwner): void {
  removeEntry(owner)
}

/** Memory-pressure shed: dispose every retained hidden context (its glyph atlas goes with it).
 *  Reveal reattaches WebGL exactly as it does after an over-cap eviction. Returns owners released. */
export function releaseAllRetainedHiddenWebgl(): number {
  const released = retainedEntries.splice(0)
  for (const entry of released) {
    clearExpiry(entry)
    disposeEntryContexts(entry)
  }
  return released.length
}

export function retainedHiddenWebglOwnerCountForTest(): number {
  return retainedEntries.length
}

export function resetHiddenWebglRetentionForTest(): void {
  for (const entry of retainedEntries) {
    clearExpiry(entry)
  }
  retainedEntries.length = 0
}
