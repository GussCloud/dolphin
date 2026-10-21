import { readdirSync, readFileSync } from 'node:fs'
import { readdir, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { getAppEnvironment } from '../../shared/app-environment'
import type { ProcessLivenessVerdict } from './daemon-incarnation-evidence-types'
import { hostRootDir, isPackagedElectronWin32, STAGING_INFIX } from './daemon-host-relocation'
import { parseDaemonPidFile } from './daemon-pid-file-parse'
import { quarantineCorruptDaemonPidRecord } from './daemon-pid-record-quarantine'
import { inspectProcessLiveness, mergeProcessLivenessVerdict } from './daemon-process-inspection'

// Reclaiming superseded daemon-host/<ver> copies (daemon-host-relocation.ts creates them). Nothing on
// the startup critical path needs it, so it runs deferred and asynchronously.

/** Long enough for the first window to paint before a multi-hundred-MB recursive delete starts. */
export const DAEMON_HOST_PRUNE_DELAY_MS = 30_000

// No copy runs this long, so an older staging dir is a crashed copy's leftover, not a peer's in-flight one.
const STAGING_IN_FLIGHT_MAX_AGE_MS = 60 * 60_000

export type PinnedDaemonVersionsEvidence =
  | { status: 'complete'; versionLiveness: ReadonlyMap<string, ProcessLivenessVerdict> }
  | { status: 'unverifiable'; reason: string }

/**
 * App versions still pinned by a live daemon (from daemon-v<N>.pid files under `runtimeDir`), whose
 * host dir must not be reclaimed while alive. On win32 start-time can't verify, so a matching pid pins conservatively.
 */
export function collectPinnedDaemonVersions(runtimeDir: string): PinnedDaemonVersionsEvidence {
  const versionLiveness = new Map<string, ProcessLivenessVerdict>()
  let entries
  try {
    entries = readdirSync(runtimeDir, { withFileTypes: true })
  } catch {
    return { status: 'unverifiable', reason: 'the daemon runtime directory could not be read' }
  }
  for (const entry of entries) {
    if (!entry.isFile() || !/^daemon-v\d+\.pid$/.test(entry.name)) {
      continue
    }
    let contents
    try {
      contents = readFileSync(join(runtimeDir, entry.name), 'utf8')
    } catch {
      // Read failures (AV lock, vanished file) are transient; the veto re-evaluates next launch.
      return {
        status: 'unverifiable',
        reason: `the daemon pid file could not be read: ${entry.name}`
      }
    }
    const parsed = parseDaemonPidFile(contents)
    // Why not just `!parsed`: the parser's legacy bare-integer fallback coerces an empty or
    // whitespace-only record to pid 0 (Number('') === 0), which is the exact shape a concurrent
    // read sees while a live daemon publishes its record — writeFileSync 'wx' creates the file
    // before writing it. Such a record would otherwise pass as a valid pre-relocation daemon,
    // skip on appVersion === null, and leave its version unpinned, so the prune below would
    // reclaim a running daemon's host image. A pid that is not a positive integer names no
    // process — process.kill(0, 0) probes the caller's own process group, never a daemon — so
    // it is not liveness evidence and must veto rather than be skipped.
    if (!parsed || !Number.isInteger(parsed.pid) || parsed.pid <= 0) {
      return {
        status: 'unverifiable',
        reason: quarantineCorruptDaemonPidRecord(runtimeDir, entry.name, contents)
      }
    }
    // appVersion null => pre-relocation daemon forked from the install dir; pins no host dir here.
    if (parsed.appVersion === null) {
      continue
    }
    const verdict = inspectProcessLiveness(parsed.pid)
    versionLiveness.set(
      parsed.appVersion,
      mergeProcessLivenessVerdict(versionLiveness.get(parsed.appVersion), verdict)
    )
  }
  return { status: 'complete', versionLiveness }
}

// Why: deletion is the destructive direction and this is a statement position the compiler does
// not police for exhaustiveness — reclaim must be opted into by a positively matched 'exited',
// so any future unhandled verdict status preserves the host dir instead of deleting it.
export async function reclaimUnownedDaemonHostDir(
  verdict: ProcessLivenessVerdict,
  hostDir: string
): Promise<void> {
  if (verdict.status !== 'exited') {
    return
  }
  try {
    await rm(hostDir, { recursive: true, force: true })
  } catch {
    // Still locked or already gone — retry on a future launch.
  }
}

async function isStagingInFlight(stagingDir: string): Promise<boolean> {
  try {
    return Date.now() - (await stat(stagingDir)).mtimeMs < STAGING_IN_FLIGHT_MAX_AGE_MS
  } catch {
    return false
  }
}

/**
 * Reclaim daemon-host/<ver> dirs that are neither the current version nor pinned by a live daemon.
 * Best-effort — never rejects; a locked/staging dir is retried on a future launch.
 */
export async function pruneOldDaemonHosts(evidence: PinnedDaemonVersionsEvidence): Promise<void> {
  if (!isPackagedElectronWin32()) {
    return
  }
  if (evidence.status === 'unverifiable') {
    console.warn(`[daemon] Skipping daemon-host prune: ${evidence.reason}`)
    return
  }
  const version = getAppEnvironment().getVersion()
  const root = hostRootDir()
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === version) {
      continue
    }
    const hostDir = join(root, entry.name)
    // Why: a staging dir has no pid record, so the liveness map would call it unowned and
    // delete a copy another launch is still writing.
    if (entry.name.includes(STAGING_INFIX) && (await isStagingInFlight(hostDir))) {
      continue
    }
    // A complete runtime-dir listing with no pid record for this version proves it is unowned.
    const verdict = evidence.versionLiveness.get(entry.name) ?? { status: 'exited' }
    await reclaimUnownedDaemonHostDir(verdict, hostDir)
  }
}

let pruneScheduled = false

/** Prune once per process, after startup has had the main thread and threadpool to itself. */
export function scheduleOldDaemonHostPrune(
  runtimeDir: string,
  delayMs = DAEMON_HOST_PRUNE_DELAY_MS
): void {
  if (pruneScheduled || !isPackagedElectronWin32()) {
    return
  }
  pruneScheduled = true
  const timer = setTimeout(() => {
    // Evidence is read at prune time, not schedule time, so a daemon published during the delay still vetoes.
    let evidence: PinnedDaemonVersionsEvidence
    try {
      evidence = collectPinnedDaemonVersions(runtimeDir)
    } catch (error) {
      console.warn('[daemon] Skipping daemon-host prune:', error)
      return
    }
    void pruneOldDaemonHosts(evidence).catch((error: unknown) => {
      console.warn('[daemon] daemon-host prune failed:', error)
    })
  }, delayMs)
  // Quitting before it fires only defers the reclaim to the next launch.
  timer.unref?.()
}
