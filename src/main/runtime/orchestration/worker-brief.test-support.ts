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
