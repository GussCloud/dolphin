// Host-wide queue for heavy commands (build, full test suite, e2e, packaging) that orchestration
// workers in sibling worktrees would otherwise run all at once.

/** Heavy jobs one execution host runs at once per repository. */
export const HEAVY_JOB_DEFAULT_CONCURRENCY = 1
/** A lease not refreshed within this window belongs to a dead holder and is reclaimed. */
export const HEAVY_JOB_LEASE_TTL_MS = 60_000
export const HEAVY_JOB_HEARTBEAT_INTERVAL_MS = 15_000
/** Longest one acquire call waits on the host before answering "still queued". */
export const HEAVY_JOB_ACQUIRE_LONG_POLL_MS = 20_000
// Why: agent Bash tools time out at 10 min (Claude: 2 min default), so give up before that.
export const HEAVY_JOB_DEFAULT_MAX_WAIT_MS = 8 * 60_000
/** EX_TEMPFAIL: the queue stayed busy past --max-wait-ms and nothing ran. */
export const HEAVY_JOB_QUEUE_TIMEOUT_EXIT_CODE = 75
/** The command must run on an execution host this CLI process is not on. */
export const HEAVY_JOB_WRONG_HOST_EXIT_CODE = 69

export type HeavyJobAcquireResult = {
  ticket: string
  granted: boolean
  /** Running jobs plus waiters queued before this one. */
  ahead: number
}
