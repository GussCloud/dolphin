import { settleWithinMs } from '../quit-teardown-deadline'
import type { DolphinCloudSession } from './profile-cloud-session-store'

type DolphinCloudSigningOutListener = (session: DolphinCloudSession) => Promise<void>

// Why bounded: sign-out is user-awaited and the listeners' requests are best-effort goodbyes.
const SIGNING_OUT_LISTENER_DEADLINE_MS = 3_000

const listeners = new Set<DolphinCloudSigningOutListener>()

/** Runs before sign-out revokes the session, so listeners can still call the API with it. */
export function onDolphinCloudSigningOut(listener: DolphinCloudSigningOutListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export async function emitDolphinCloudSigningOut(session: DolphinCloudSession): Promise<void> {
  const settled = Promise.allSettled([...listeners].map((listener) => listener(session)))
  await settleWithinMs(settled, SIGNING_OUT_LISTENER_DEADLINE_MS)
}
