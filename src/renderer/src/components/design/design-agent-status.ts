import { useEffect, useState } from 'react'
import { installWindowVisibilityInterval, isWindowVisible } from '@/lib/window-visibility-interval'
import type { DesignAgentStatus } from '../../../../shared/design-types'
import { isDesignMethodMissing, readDesignAgentStatus } from './design-index'

export const DESIGN_AGENT_STATUS_POLL_MS = 4_000
const HOOK_SIGNAL_DEBOUNCE_MS = 250

/**
 * The design agent's pane as its host sees it; null while unverifiable (loading, a host without
 * `design.agentStatus`, a failed call). Polls the host so any window, local or remote, gets it.
 */
export function useDesignAgentStatus(
  designId: string,
  paneKey: string | null,
  /** Changes when the design does, so a reply or ack re-reads at once. */
  revision: number
): DesignAgentStatus | null {
  const [reading, setReading] = useState<{
    designId: string
    status: DesignAgentStatus | null
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    let unsupported = false
    let seq = 0
    const refresh = (): void => {
      if (unsupported || !isWindowVisible()) {
        return
      }
      const current = ++seq
      readDesignAgentStatus(designId).then(
        (status) => {
          if (!cancelled && current === seq) {
            setReading({ designId, status })
          }
        },
        (error: unknown) => {
          if (cancelled || current !== seq) {
            return
          }
          // Why stop polling: an older host will not grow the method while this view is open.
          unsupported = isDesignMethodMissing(error)
          setReading({ designId, status: null })
        }
      )
    }
    const stopInterval = installWindowVisibilityInterval({
      run: refresh,
      intervalMs: DESIGN_AGENT_STATUS_POLL_MS
    })
    let debounce: ReturnType<typeof setTimeout> | null = null
    // Why only a speed-up: hook events reach local windows only; the poll is what every window relies on.
    const stopHookSignal = window.api?.agentStatus?.onSet((payload) => {
      if (paneKey === null || payload.paneKey !== paneKey || debounce !== null) {
        return
      }
      debounce = setTimeout(() => {
        debounce = null
        refresh()
      }, HOOK_SIGNAL_DEBOUNCE_MS)
    })
    return () => {
      cancelled = true
      stopInterval()
      stopHookSignal?.()
      if (debounce !== null) {
        clearTimeout(debounce)
      }
    }
  }, [designId, paneKey, revision])

  return reading?.designId === designId ? reading.status : null
}
