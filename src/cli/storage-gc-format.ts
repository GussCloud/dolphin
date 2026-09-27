import type { StorageGcResult } from '../shared/storage-gc-types'
import { formatDuration } from './runtime-diagnostics-format'
import { formatByteCount } from './workspace-format'

const MAX_LISTED = 20

export function formatStorageGcResult(result: StorageGcResult, now = Date.now()): string {
  const lines = [
    result.dryRun ? 'GC PLAN (dry run, nothing removed)' : 'GC',
    '',
    'Terminal session history',
    `  Scanned:      ${result.scannedSessionCount} sessions, ${formatByteCount(result.totalBytes)}`,
    `  Policy:       older than ${formatDuration(result.policy.maxAgeMs)}, or oldest first above ${formatByteCount(result.policy.maxTotalBytes)}`,
    `  ${result.dryRun || result.refusedReason ? 'Reclaimable' : 'Reclaimed'}:  ${result.removed.length} sessions, ${formatByteCount(result.reclaimableBytes)}`
  ]
  for (const candidate of result.removed.slice(0, MAX_LISTED)) {
    lines.push(
      `    - ${candidate.sessionId}  ${formatByteCount(candidate.bytes)}  idle ${formatDuration(now - candidate.lastActivityAt)}`
    )
  }
  if (result.removed.length > MAX_LISTED) {
    lines.push(`    ... ${result.removed.length - MAX_LISTED} more`)
  }
  const kept = Object.entries(result.keptByReason)
  if (kept.length > 0) {
    lines.push(`  Kept:         ${kept.map(([reason, count]) => `${reason} ${count}`).join(', ')}`)
  }
  if (result.refusedReason === 'daemon-inventory-incomplete') {
    lines.push(
      '',
      'Nothing was removed: a terminal daemon did not report its live sessions, so no',
      'history can be proven unowned. Retry once `orca diagnostics runtime` shows a complete inventory.'
    )
  }
  return lines.join('\n')
}
