import { useEffect, useState } from 'react'
import type { Design } from '../../../../shared/design-types'

/** How long a Draft may wait for its agent's first `dolphin design` call before it reads as stuck. */
export const DESIGN_AGENT_BIND_TIMEOUT_MS = 10 * 60 * 1000

/** A Draft whose agent never bound a terminal: the launch likely failed, so no one is drawing it. */
export function isDesignAgentMissing(
  design: Pick<Design, 'paneKey' | 'status' | 'createdAt'>,
  now: number
): boolean {
  return (
    design.status === 'draft' &&
    design.paneKey === null &&
    now - design.createdAt > DESIGN_AGENT_BIND_TIMEOUT_MS
  )
}

const CLOCK_TICK_MS = 60 * 1000

/** Wall clock refreshed once a minute, so the bind timeout can elapse while a screen stays open. */
export function useDesignMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), CLOCK_TICK_MS)
    return () => window.clearInterval(timer)
  }, [])
  return now
}
