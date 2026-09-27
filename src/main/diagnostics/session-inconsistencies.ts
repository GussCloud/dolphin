import type { SessionInconsistency } from '../../shared/runtime-diagnostics-types'

export type RegisteredPtyFact = { ptyId: string; pid: number | null }
export type DaemonSessionFact = { sessionId: string; pid: number | null; isAlive: boolean }
export type PidLiveness = 'live' | 'exited' | 'unverifiable'

export function findSessionInconsistencies(args: {
  registered: readonly RegisteredPtyFact[]
  /** Null when the daemon inventory is incomplete: cross-checks against it would be guesses. */
  daemonSessions: readonly DaemonSessionFact[] | null
  /** False in degraded mode, where fresh PTYs legitimately run outside the daemon. */
  expectRegisteredInDaemon: boolean
  probePid: (pid: number) => PidLiveness
  /** Session ids any saved tab names; omitted means unknown, so no orphan verdicts. */
  referencedBySavedTabs?: ReadonlySet<string>
  /** Session ids with history on disk that a reopen could cold-restore. */
  restorableSessionIds?: ReadonlySet<string>
}): SessionInconsistency[] {
  const findings: SessionInconsistency[] = []
  const registeredIds = new Set(args.registered.map((pty) => pty.ptyId))
  const daemonIds = args.daemonSessions
    ? new Set(args.daemonSessions.filter((s) => s.isAlive).map((s) => s.sessionId))
    : null

  for (const pty of args.registered) {
    // Why only 'exited': an unverifiable probe (EPERM, platform gap) is never evidence of death.
    if (pty.pid !== null && args.probePid(pty.pid) === 'exited') {
      findings.push({ kind: 'registered-pty-exited', sessionId: pty.ptyId, pid: pty.pid })
      continue
    }
    if (args.expectRegisteredInDaemon && daemonIds && !daemonIds.has(pty.ptyId)) {
      findings.push({
        kind: 'registered-pty-missing-from-daemon',
        sessionId: pty.ptyId,
        pid: pty.pid
      })
    }
  }

  for (const session of args.daemonSessions ?? []) {
    if (session.isAlive && !registeredIds.has(session.sessionId)) {
      const orphaned =
        args.referencedBySavedTabs !== undefined &&
        !args.referencedBySavedTabs.has(session.sessionId)
      findings.push({
        kind: orphaned ? 'daemon-session-orphaned' : 'daemon-session-untracked',
        sessionId: session.sessionId,
        pid: session.pid
      })
    }
  }

  // Why only with a complete inventory: otherwise "not live" is merely unknown.
  if (daemonIds && args.referencedBySavedTabs && args.restorableSessionIds) {
    for (const sessionId of args.referencedBySavedTabs) {
      if (!daemonIds.has(sessionId) && !args.restorableSessionIds.has(sessionId)) {
        findings.push({ kind: 'saved-tab-session-unavailable', sessionId, pid: null })
      }
    }
  }
  return findings
}

export function probeLocalPid(pid: number): PidLiveness {
  try {
    process.kill(pid, 0)
    return 'live'
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? error.code : undefined
    if (code === 'ESRCH') {
      return 'exited'
    }
    // Why: EPERM means the pid exists under another user; anything else is not proof either way.
    return code === 'EPERM' ? 'live' : 'unverifiable'
  }
}
