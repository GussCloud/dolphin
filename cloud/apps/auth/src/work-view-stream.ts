import type { Context } from 'hono'
import { streamSSE } from 'hono/streaming'
import type { WorkPresenceRegistry, WorkView } from './work-presence-registry.js'

export type WorkViewStreamTiming = { throttleMs: number; keepaliveMs: number }

export const DEFAULT_STREAM_TIMING: WorkViewStreamTiming = { throttleMs: 500, keepaliveMs: 15_000 }

/**
 * Pushes the org's whole view as `event: snapshot`, coalescing bursts and skipping unchanged views.
 * `stillAllowed` is re-checked on every keepalive so a revoked link or removed member is cut off.
 */
export function workViewStream(
  c: Context,
  deps: {
    registry: WorkPresenceRegistry
    view: () => WorkView
    stillAllowed: () => boolean
    timing?: WorkViewStreamTiming
  }
): Response {
  const timing = deps.timing ?? DEFAULT_STREAM_TIMING
  return streamSSE(c, async (stream) => {
    let last = ''
    let pending: ReturnType<typeof setTimeout> | undefined
    const send = async (): Promise<void> => {
      pending = undefined
      const data = JSON.stringify(deps.view())
      if (data !== last && !stream.aborted) {
        last = data
        await stream.writeSSE({ event: 'snapshot', data })
      }
    }
    const done = new Promise<void>((resolve) => stream.onAbort(resolve))
    await send()
    const unsubscribe = deps.registry.subscribe(() => {
      pending ??= setTimeout(() => void send(), timing.throttleMs)
    })
    const keepalive = setInterval(() => {
      if (!deps.stillAllowed()) {
        stream.abort()
        return
      }
      void stream.write(': keepalive\n\n')
    }, timing.keepaliveMs)
    await done
    unsubscribe()
    clearInterval(keepalive)
    clearTimeout(pending)
  })
}
