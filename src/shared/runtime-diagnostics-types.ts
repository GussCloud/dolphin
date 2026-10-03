import type { MemorySnapshot } from './process-stats-types'
import type { ProcessHeapSample } from './process-heap-sample'
import type { SessionLifecycleState } from './session-lifecycle'

export type StorageFootprintKind =
  | 'terminal-history'
  | 'terminal-history-wsl'
  | 'codex-runtime-home'
  | 'codex-accounts'
  | 'logs'

export type StorageFootprintEntry = {
  kind: StorageFootprintKind
  path: string
  exists: boolean
  /** Apparent file bytes; a hardlinked file counts once across every entry. */
  bytes: number
  fileCount: number
  /** Direct children of the root, e.g. one per daemon session for terminal-history. */
  topLevelEntryCount: number
  /** The walk hit its entry cap, so bytes and fileCount are lower bounds. */
  truncated: boolean
}

export type StorageFootprint = {
  entries: StorageFootprintEntry[]
  totalBytes: number
}

/**
 * A mismatch between what main tracks and what the daemon or OS reports. These are suspects for a
 * reaper to confirm, never a kill verdict on their own.
 */
export type SessionInconsistencyKind =
  /** Main still tracks a PTY whose root process the OS says has exited. */
  | 'registered-pty-exited'
  /** Main tracks a PTY the daemon does not list. */
  | 'registered-pty-missing-from-daemon'
  /** The daemon hosts a live session main does not track, though a saved tab still names it. */
  | 'daemon-session-untracked'
  /** The daemon hosts a live session nothing tracks or references: it costs resources with no UI. */
  | 'daemon-session-orphaned'
  /** A saved tab names a session that is neither live nor restorable; reopening starts fresh. */
  | 'saved-tab-session-unavailable'

export type SessionInconsistency = {
  kind: SessionInconsistencyKind
  sessionId: string
  pid: number | null
}

export type MemoryBudgetWarning = {
  kind: 'renderer' | 'session' | 'daemon'
  subject: string
  bytes: number
  limitBytes: number
}

export type RuntimeDiagnostics = {
  collectedAt: number
  runtime: {
    appVersion: string
    platform: string
    arch: string
    mainPid: number
    uptimeMs: number
    daemonPid: number | null
    daemonDegraded: boolean
  }
  sessions: {
    registeredPtyCount: number
    /** Null when no daemon answered, so its inventory is unknown rather than empty. */
    daemonSessionCount: number | null
    daemonSessionsByState: Record<string, number>
    /** False when any daemon adapter failed to list; untracked/missing findings are then withheld. */
    daemonInventoryComplete: boolean
    oldestDaemonSessionCreatedAt: number | null
    inconsistencies: SessionInconsistency[]
    /** Tracked PTYs the daemon agrees are live. Absent from older hosts. */
    matchedSessionCount?: number
    /** Main's view of local PTY lifecycles, including recently reaped ones. Absent from older hosts. */
    localLifecycleByState?: Partial<Record<SessionLifecycleState, number>>
    /** Transitions the state machine refused; nonzero means layers disagree about a session. */
    rejectedLifecycleTransitions?: number
  }
  memory: MemorySnapshot
  /** Over-budget owners; absent from older hosts. */
  memoryWarnings?: MemoryBudgetWarning[]
  /** Self-reported JS heaps; absent from older hosts. `daemon` is null when it did not answer. */
  heap?: {
    host: ProcessHeapSample
    daemon: ProcessHeapSample | null
  }
  storage: StorageFootprint
}
