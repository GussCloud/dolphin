import type { DolphinRuntimeService } from '../dolphin-runtime'
import { getWorkerBriefStore } from './worker-brief-store'

/** The brief a pasted dispatch pointer names, or the pasted text itself when it was the brief. */
export function deliveredWorkerBrief(runtime: DolphinRuntimeService, pasted: unknown): string {
  const text = String(pasted)
  const dispatchId = /worker-brief --dispatch (\S+)/.exec(text)?.[1]
  if (!dispatchId) {
    return text
  }
  const held = getWorkerBriefStore(runtime).read(dispatchId)
  if (!held) {
    throw new Error(`No brief held for pasted pointer: ${text}`)
  }
  return held.brief
}

/** A worker launched with the pointer fetches its brief at once, as a live agent would. */
export function autoFetchHeldWorkerBriefs(runtime: DolphinRuntimeService): () => void {
  const store = getWorkerBriefStore(runtime)
  const hold = store.hold.bind(store)
  store.hold = (dispatchId, entry) => {
    hold(dispatchId, entry)
    store.markFetched(dispatchId)
  }
  // Undo for a start whose agent never runs (failed setup, exited terminal).
  return () => {
    store.hold = hold
  }
}
