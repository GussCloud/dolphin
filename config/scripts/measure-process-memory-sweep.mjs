// OS process sweep for measure-process-memory.mjs: one row per process with
// working set, the `privateMetric` byte figure, and cumulative CPU seconds.

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const rootDir = path.resolve(import.meta.dirname, '..', '..')

const footprintHelperPath = path.join(
  rootDir,
  'native',
  'process-footprint-macos',
  '.build',
  'release',
  'dolphin-process-footprint'
)
export const privateMetric =
  process.platform === 'win32'
    ? 'private-bytes'
    : process.platform === 'darwin' && existsSync(footprintHelperPath)
      ? 'footprint'
      : 'rss'

// ps `time=` is MM:SS.cc on macOS (e.g. 51:47.23) and [DD-]HH:MM:SS on Linux.
function parsePsCpuSeconds(text, platform = process.platform) {
  const parts = text.split(':').map(Number)
  if (platform === 'darwin') {
    const [minutes, seconds] = parts.length === 2 ? parts : [0, parts[0]]
    return (minutes || 0) * 60 + (seconds || 0)
  }
  const [daysPart, clock] = text.includes('-') ? text.split('-') : ['0', text]
  const [h, m, s] = clock.split(':').map(Number)
  return Number(daysPart) * 86400 + (h || 0) * 3600 + (m || 0) * 60 + (s || 0)
}

function readFootprints() {
  const out = execFileSync(footprintHelperPath, [], { encoding: 'utf8', timeout: 5_000 })
  const footprints = new Map()
  for (const line of out.trim().split('\n')) {
    const [pid, bytes] = line.trim().split(/\s+/).map(Number)
    if (Number.isFinite(pid) && Number.isFinite(bytes)) {
      footprints.set(pid, bytes)
    }
  }
  return footprints
}

export function sweepProcesses() {
  if (process.platform !== 'win32') {
    const out = execFileSync('ps', ['-eo', 'pid=,ppid=,rss=,time=,comm='], { encoding: 'utf8' })
    const footprints = privateMetric === 'footprint' ? readFootprints() : null
    return out
      .trim()
      .split('\n')
      .map((line) => {
        const [pid, ppid, rss, time, ...name] = line.trim().split(/\s+/)
        return {
          pid: Number(pid),
          ppid: Number(ppid),
          name: name.join(' '),
          workingSet: Number(rss) * 1024,
          // Why 0, not RSS, for an unreadable pid: the column must stay one metric.
          privateBytes: footprints ? (footprints.get(Number(pid)) ?? 0) : Number(rss) * 1024,
          cpuSeconds: parsePsCpuSeconds(time)
        }
      })
  }
  const script =
    'Get-CimInstance Win32_Process | ForEach-Object { "{0}|{1}|{2}|{3}|{4}|{5}|{6}" -f ' +
    '$_.ProcessId,$_.ParentProcessId,$_.Name,$_.WorkingSetSize,$_.PrivatePageCount,' +
    '($_.UserModeTime + $_.KernelModeTime),($_.CommandLine -replace "[|\r\n]"," ") }'
  const out = execFileSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    {
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 32 * 1024 * 1024
    }
  )
  return out
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [pid, ppid, name, ws, priv, ticks, commandLine = ''] = line.split('|')
      return {
        commandLine,
        pid: Number(pid),
        ppid: Number(ppid),
        name,
        workingSet: Number(ws),
        privateBytes: Number(priv),
        cpuSeconds: Number(ticks) / 1e7
      }
    })
}
