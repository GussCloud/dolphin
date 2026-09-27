import type { IPtyProvider } from '../../../providers/types'
import { ptyIncarnationById } from './ownership-state'
import { markRegisteredPtyStopping } from '../../../memory/pty-registry'

export async function shutdownProviderAndDetectExit(
  provider: IPtyProvider,
  id: string,
  opts: { immediate?: boolean; keepHistory?: boolean; deadlineMs?: number }
): Promise<boolean> {
  // Why here: every renderer and runtime stop funnels through this call.
  markRegisteredPtyStopping(id)
  let providerExitObserved = false
  const expectedIncarnationId = ptyIncarnationById.get(id)
  const unsubscribe = provider.onExit((payload) => {
    if (
      payload.id === id &&
      (!expectedIncarnationId || payload.incarnationId === expectedIncarnationId)
    ) {
      providerExitObserved = true
    }
  })
  try {
    await provider.shutdown(id, opts)
  } finally {
    unsubscribe()
  }
  return providerExitObserved
}
