import type { RuntimeDiagnostics } from '../shared/runtime-diagnostics-types'
import { formatByteCount } from './workspace-format'

const MAX_LISTED_INCONSISTENCIES = 20

export function formatRuntimeDiagnostics(d: RuntimeDiagnostics): string {
  const { runtime, sessions, memory, storage } = d
  const sessionProcessCount = memory.worktrees.reduce(
    (sum, wt) => sum + wt.sessions.reduce((n, s) => n + (s.processCount ?? 0), 0),
    0
  )
  const lines = [
    'ORCA DIAGNOSTICS',
    '',
    'Runtime',
    `  Version:        ${runtime.appVersion}`,
    `  Platform:       ${runtime.platform}`,
    `  Architecture:   ${runtime.arch}`,
    `  Uptime:         ${formatDuration(runtime.uptimeMs)}`,
    `  Main PID:       ${runtime.mainPid}`,
    `  Daemon PID:     ${runtime.daemonPid ?? 'none'}${runtime.daemonDegraded ? ' (degraded)' : ''}`,
    '',
    'Sessions',
    `  Registered PTYs:      ${sessions.registeredPtyCount}`,
    `  Daemon sessions:      ${formatDaemonSessionCount(d)}`,
    ...Object.entries(sessions.daemonSessionsByState)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([state, count]) => `    ${state}: ${count}`),
    ...(sessions.oldestDaemonSessionCreatedAt === null
      ? []
      : [
          `  Oldest session age:   ${formatDuration(d.collectedAt - sessions.oldestDaemonSessionCreatedAt)}`
        ]),
    `  Inconsistencies:      ${sessions.inconsistencies.length}`,
    ...sessions.inconsistencies
      .slice(0, MAX_LISTED_INCONSISTENCIES)
      .map((f) => `    - ${f.kind}  ${f.sessionId}${f.pid === null ? '' : `  pid ${f.pid}`}`),
    ...(sessions.inconsistencies.length > MAX_LISTED_INCONSISTENCIES
      ? [`    ... ${sessions.inconsistencies.length - MAX_LISTED_INCONSISTENCIES} more`]
      : []),
    '',
    'Processes',
    `  In session trees:     ${memory.trackedProcessCount ?? sessionProcessCount}`,
    `  Untracked under daemon: ${memory.daemon ? memory.daemon.untrackedDescendantCount : 'unknown'}`,
    '',
    'Memory',
    `  Orca main:            ${formatByteCount(memory.app.main.memory)}`,
    `  Orca renderer:        ${formatByteCount(memory.app.renderer.memory)}`,
    `  Orca other:           ${formatByteCount(memory.app.other.memory)}`,
    `  Terminal daemon:      ${memory.daemon ? formatByteCount(memory.daemon.memory) : 'unknown'}`,
    `  Session trees:        ${formatByteCount(memory.totalMemory - memory.app.memory)}`,
    `  Total Orca tree:      ${formatByteCount(memory.totalMemory + (memory.daemon?.memory ?? 0))}`,
    ...(typeof memory.totalPrivateMemory === 'number'
      ? [`  Committed (private):  ${formatByteCount(memory.totalPrivateMemory)}`]
      : []),
    `  Metric:               ${memory.processMemoryMetric}`,
    '',
    'Disk',
    ...storage.entries.map(
      (entry) =>
        `  ${`${entry.kind}:`.padEnd(22)}${entry.exists ? formatByteCount(entry.bytes) : 'absent'}${
          entry.exists ? `  (${entry.fileCount} files, ${entry.topLevelEntryCount} entries)` : ''
        }${entry.truncated ? '  [partial]' : ''}`
    ),
    `  ${'total:'.padEnd(22)}${formatByteCount(storage.totalBytes)}`
  ]
  return lines.join('\n')
}

function formatDaemonSessionCount(d: RuntimeDiagnostics): string {
  if (d.sessions.daemonSessionCount === null) {
    return 'no daemon'
  }
  return `${d.sessions.daemonSessionCount}${d.sessions.daemonInventoryComplete ? '' : ' (partial: a daemon did not answer)'}`
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000))
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) {
    return `${days}d ${hours}h`
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}
