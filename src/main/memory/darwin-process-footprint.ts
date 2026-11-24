/**
 * Reads macOS physical footprint (Activity Monitor's "Memory" column) per pid
 * through the bundled dolphin-process-footprint helper.
 *
 * Why not `ps rss`: on macOS RSS excludes compressed, swapped and GPU memory,
 * so it under-reports Dolphin by half or more under memory pressure.
 */

import { existsSync } from 'node:fs'
import os from 'node:os'
import { dirname, join } from 'node:path'
import { runProcess } from '../../shared/child-process/run-process'
import {
  getProcessOutputFields,
  iterateProcessOutputLines
} from '../../shared/process-output-field-scanner'

const HELPER_EXECUTABLE = 'dolphin-process-footprint'
const HELPER_TIMEOUT_MS = 2_000
// ~800 pids x ~20 bytes per line; truncation means missing pids, so it counts as failure.
const HELPER_MAX_OUTPUT_BYTES = 256 * 1024
const RETRY_INITIAL_MS = 5_000
const RETRY_MAX_MS = 60_000

type ReaderState = {
  /** undefined = not resolved yet; null = no helper on this host (permanent). */
  helperPath: string | null | undefined
  retryAtMs: number
  retryDelayMs: number
}

const state: ReaderState = {
  helperPath: undefined,
  retryAtMs: 0,
  retryDelayMs: RETRY_INITIAL_MS
}

function resolveHelperPath(): string | null {
  if (state.helperPath !== undefined) {
    return state.helperPath
  }
  // Why next to process.execPath: dev copies and packaged builds (extraFiles) both put it in Contents/MacOS.
  const candidate = join(dirname(process.execPath), HELPER_EXECUTABLE)
  state.helperPath = existsSync(candidate) ? candidate : null
  return state.helperPath
}

/** Exported for tests: parses `pid footprintBytes` lines. */
export function parseProcessFootprintOutput(stdout: string): Map<number, number> {
  const footprints = new Map<number, number>()
  for (const line of iterateProcessOutputLines(stdout)) {
    const fields = getProcessOutputFields(line, 2)
    if (fields.length < 2) {
      continue
    }
    const pid = Number(fields[0])
    const bytes = Number(fields[1])
    if (!Number.isSafeInteger(pid) || pid <= 0 || !Number.isFinite(bytes) || bytes < 0) {
      continue
    }
    footprints.set(pid, bytes)
  }
  return footprints
}

function noteTransientFailure(): void {
  state.retryAtMs = performance.now() + state.retryDelayMs
  state.retryDelayMs = Math.min(state.retryDelayMs * 2, RETRY_MAX_MS)
}

function isMissingExecutableError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

/**
 * Physical footprint in bytes per pid; omitted pids could not be read (another
 * user's process, or it exited). `pids` limits the read; omit it for every pid.
 *
 * Null means unavailable for this call: non-darwin, helper missing, timeout or
 * bad exit. Only a missing helper disables the reader for the process lifetime;
 * other failures retry after a growing backoff.
 */
export async function readDarwinProcessFootprints(
  pids?: readonly number[]
): Promise<ReadonlyMap<number, number> | null> {
  if (os.platform() !== 'darwin') {
    return null
  }
  const helperPath = resolveHelperPath()
  if (helperPath === null || performance.now() < state.retryAtMs) {
    return null
  }
  let args: string[] = []
  if (pids !== undefined) {
    args = pids.filter((pid) => Number.isSafeInteger(pid) && pid > 0).map(String)
    // Why: no args means "every pid" to the helper, the opposite of an empty request.
    if (args.length === 0) {
      return new Map()
    }
  }
  try {
    const result = await runProcess({
      program: helperPath,
      args,
      timeoutMs: HELPER_TIMEOUT_MS,
      maxOutputBytes: HELPER_MAX_OUTPUT_BYTES
    })
    if (result.code !== 0 || result.timedOut || result.outputTruncated) {
      noteTransientFailure()
      return null
    }
    state.retryDelayMs = RETRY_INITIAL_MS
    return parseProcessFootprintOutput(result.stdout)
  } catch (error) {
    if (isMissingExecutableError(error)) {
      state.helperPath = null
    } else {
      noteTransientFailure()
    }
    return null
  }
}
