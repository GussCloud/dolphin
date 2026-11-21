import { useMemo, useRef } from 'react'
import { useAppStore } from '@/store'
import {
  selectAgentBucketCountState,
  type AgentBucketCountState
} from '@/components/dashboard/useAgentBucketCounts'
import {
  buildNeedsYouRows,
  createNeedsYouRowsCache,
  type NeedsYouRow,
  type NeedsYouRowsCache
} from './needs-you-rows'

// Why the clock is read here and not a memo dep: decay follows agentStatusEpoch (in `state`), which is also the cache generation.
function buildNeedsYouRowsAtNow(
  state: AgentBucketCountState,
  cache: NeedsYouRowsCache
): NeedsYouRow[] {
  return buildNeedsYouRows(state, Date.now(), cache, state.agentStatusEpoch)
}

/** Attention rows for the sidebar "Needs you" section; recomputes only when an input slice changes. */
export function useNeedsYouRows(): NeedsYouRow[] {
  // Why the bucket-count selector: identical inputs, and its module-scope identity gate keeps the per-write path allocation-free.
  const state = useAppStore(selectAgentBucketCountState)
  const cacheRef = useRef<NeedsYouRowsCache>(undefined!)
  cacheRef.current ??= createNeedsYouRowsCache()
  return useMemo(() => buildNeedsYouRowsAtNow(state, cacheRef.current), [state])
}
