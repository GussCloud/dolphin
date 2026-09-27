import {
  terminateDescendantSnapshotWithVerdict,
  type DescendantTreeVerdict
} from '../pty-descendant-exit-verification'
import type { DescendantSnapshot } from '../pty-descendant-termination'

export type DescendantSurvivorReport = (event: string, details: Record<string, unknown>) => void

// Why a delay: a descendant can outlive SIGKILL briefly (uninterruptible I/O, a reparent in flight).
export const DESCENDANT_SURVIVOR_CONFIRM_DELAY_MS = 10_000

type ConfirmDeps = {
  delayMs?: number
  confirm?: (snapshot: DescendantSnapshot) => Promise<DescendantTreeVerdict>
}

/**
 * Suspect → confirm → terminate for descendants a shutdown left `live`. The second pass re-checks
 * start time and pgid before signalling, so a pid reused by an unrelated process is never touched.
 * Resolves with the confirmed verdict, or null when the first verdict needed no follow-up.
 */
export async function confirmShutdownDescendantSurvivors(
  sessionId: string,
  snapshot: DescendantSnapshot,
  verdict: DescendantTreeVerdict,
  report: DescendantSurvivorReport,
  deps: ConfirmDeps = {}
): Promise<DescendantTreeVerdict | null> {
  if (verdict !== 'live') {
    return null
  }
  const pids = snapshot.descendants.map((row) => row.pid)
  report('process-orphan-suspected', { sessionId, pids })
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, deps.delayMs ?? DESCENDANT_SURVIVOR_CONFIRM_DELAY_MS)
    // Why unref: a departing daemon must not linger for a best-effort second pass.
    timer.unref?.()
  })
  const confirm =
    deps.confirm ??
    ((s: DescendantSnapshot) =>
      terminateDescendantSnapshotWithVerdict(s, { requireIdentityBeforeSignal: true }))
  let confirmed: DescendantTreeVerdict
  try {
    confirmed = await confirm(snapshot)
  } catch {
    confirmed = 'unverifiable'
  }
  const event =
    confirmed === 'exited'
      ? 'process-orphan-reaped'
      : confirmed === 'live'
        ? 'process-orphan-confirmed'
        : 'process-orphan-unverifiable'
  report(event, { sessionId, pids })
  return confirmed
}
