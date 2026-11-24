/**
 * One host-wide process sweep: the table every snapshot attributes memory from.
 *
 * On macOS the byte column is physical footprint when the footprint helper
 * answers, otherwise the whole sweep stays RSS — never a mix of the two.
 */

import { runProcess } from '../../shared/child-process/run-process'
import {
  getProcessOutputFields,
  iterateProcessOutputLines
} from '../../shared/process-output-field-scanner'
import type { ProcessMemoryMetric } from '../../shared/process-stats-types'
import { readDarwinProcessFootprints } from './darwin-process-footprint'
import { getProcessMemoryMetric } from './process-memory-metric'
import type { ProcIndex, ProcRow } from './process-subtree'
import { enumerateWindowsProcessResources } from './windows-process-resource-collector'

const PS_EXEC_TIMEOUT_MS = 5_000
const PS_MAX_BUFFER = 10 * 1024 * 1024

export type ProcessSweep = {
  index: ProcIndex
  memoryMetric: ProcessMemoryMetric
  /** True when the host scan failed; `index` is then empty and every figure is a placeholder. */
  scanFailed: boolean
}

export async function sweepProcesses(platform: NodeJS.Platform): Promise<ProcessSweep> {
  const [rows, footprints] = await Promise.all([
    platform === 'win32' ? enumerateWindows() : enumerateUnix(platform),
    platform === 'darwin' ? readDarwinProcessFootprints() : Promise.resolve(null)
  ])
  // Why empty counts as failed: a working sweep always lists at least this process;
  // the Windows collectors report their failures as [].
  if (rows === null || rows.length === 0) {
    return {
      index: indexProcessRows([]),
      memoryMetric: getProcessMemoryMetric(platform),
      scanFailed: true
    }
  }
  if (footprints === null) {
    return {
      index: indexProcessRows(rows),
      memoryMetric: getProcessMemoryMetric(platform),
      scanFailed: false
    }
  }
  // Why 0 rather than the row's RSS: a pid the helper could not read stays uncounted, so the
  // snapshot labelled footprint carries footprint bytes only.
  const footprintRows = rows.map((row) => ({ ...row, memory: footprints.get(row.pid) ?? 0 }))
  return {
    index: indexProcessRows(footprintRows),
    memoryMetric: getProcessMemoryMetric(platform, true),
    scanFailed: false
  }
}

function indexProcessRows(rows: readonly ProcRow[]): ProcIndex {
  const byPid = new Map<number, ProcRow>()
  const childrenOf = new Map<number, number[]>()
  let hasPrivateMemory = false

  for (const row of rows) {
    byPid.set(row.pid, row)
    hasPrivateMemory ||= row.privateMemory !== undefined
    const siblings = childrenOf.get(row.ppid)
    if (siblings) {
      siblings.push(row.pid)
    } else {
      childrenOf.set(row.ppid, [row.pid])
    }
  }

  return { byPid, childrenOf, hasPrivateMemory }
}

/** Null when the scan failed, so callers never read a failure as "no processes". */
async function enumerateUnix(platform: NodeJS.Platform): Promise<ProcRow[] | null> {
  // Why: `-o pcpu` formats the percentage with the current locale's decimal
  // separator (e.g. "12,5" on de_DE). parseFloat is locale-agnostic and
  // silently drops the fractional part at a comma. Forcing C locale keeps
  // decimals as dots.
  try {
    const result = await runProcess({
      // Why absolute on macOS: /bin/ps is part of the sealed system volume; Linux distros vary.
      program: platform === 'darwin' ? '/bin/ps' : 'ps',
      args: ['-eo', 'pid=,ppid=,pcpu=,rss='],
      maxOutputBytes: PS_MAX_BUFFER,
      timeoutMs: PS_EXEC_TIMEOUT_MS,
      env: { ...process.env, LC_ALL: 'C', LANG: 'C' }
    })
    if (result.code !== 0 || result.timedOut || result.outputTruncated) {
      console.warn('[memory] ps enumeration failed', {
        code: result.code,
        signal: result.signal,
        timedOut: result.timedOut,
        outputTruncated: result.outputTruncated ?? false
      })
      return null
    }
    return parsePsOutput(result.stdout)
  } catch (err) {
    console.warn('[memory] ps enumeration failed', err)
    return null
  }
}

/** Exported for tests: parses `ps -eo pid=,ppid=,pcpu=,rss=` output. */
export function parsePsOutput(stdout: string): ProcRow[] {
  const rows: ProcRow[] = []
  for (const line of iterateProcessOutputLines(stdout)) {
    const fields = getProcessOutputFields(line, 4)
    if (fields.length < 4) {
      continue
    }
    const pid = Number.parseInt(fields[0], 10)
    const ppid = Number.parseInt(fields[1], 10)
    const cpu = Number.parseFloat(fields[2])
    const rssKb = Number.parseInt(fields[3], 10)
    if (Number.isNaN(pid) || Number.isNaN(ppid)) {
      continue
    }
    rows.push({
      pid,
      ppid,
      cpu: Number.isFinite(cpu) && cpu > 0 ? cpu : 0,
      memory: Number.isFinite(rssKb) && rssKb > 0 ? rssKb * 1024 : 0
    })
  }
  return rows
}

async function enumerateWindows(): Promise<ProcRow[]> {
  return enumerateWindowsProcessResources()
}
