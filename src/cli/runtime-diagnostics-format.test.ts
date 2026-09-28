import { describe, expect, it } from 'vitest'
import type { RuntimeDiagnostics } from '../shared/runtime-diagnostics-types'
import { formatDuration, formatRuntimeDiagnostics } from './runtime-diagnostics-format'

const usage = { cpu: 0, memory: 0 }

function diagnostics(overrides: Partial<RuntimeDiagnostics['sessions']> = {}): RuntimeDiagnostics {
  const mb = 1024 * 1024
  return {
    collectedAt: 10 * 60 * 60 * 1000,
    runtime: {
      appVersion: '1.2.3',
      platform: 'linux',
      arch: 'x64',
      mainPid: 100,
      uptimeMs: 3 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000,
      daemonPid: 200,
      daemonDegraded: false
    },
    sessions: {
      registeredPtyCount: 2,
      daemonSessionCount: 2,
      daemonSessionsByState: { running: 2 },
      daemonInventoryComplete: true,
      oldestDaemonSessionCreatedAt: 60 * 60 * 1000,
      inconsistencies: [],
      ...overrides
    },
    memory: {
      app: {
        cpu: 0,
        memory: 300 * mb,
        main: { cpu: 0, memory: 100 * mb },
        renderer: { cpu: 0, memory: 200 * mb },
        other: usage,
        history: []
      },
      worktrees: [],
      host: {
        totalMemory: 0,
        freeMemory: 0,
        availableMemory: 0,
        availableMemorySource: 'free-memory',
        usedMemory: 0,
        memoryUsagePercent: 0,
        cpuCoreCount: 1,
        loadAverage1m: 0
      },
      processMemoryMetric: 'rss',
      totalCpu: 0,
      totalMemory: 500 * mb,
      daemon: { pid: 200, cpu: 0, memory: 50 * mb, untrackedDescendantCount: 1 },
      trackedProcessCount: 7,
      collectedAt: 0
    },
    storage: {
      entries: [
        {
          kind: 'terminal-history',
          path: '/x',
          exists: true,
          bytes: 2 * mb,
          fileCount: 4,
          topLevelEntryCount: 2,
          truncated: false
        },
        {
          kind: 'logs',
          path: '/y',
          exists: false,
          bytes: 0,
          fileCount: 0,
          topLevelEntryCount: 0,
          truncated: false
        }
      ],
      totalBytes: 2 * mb
    }
  }
}

describe('formatRuntimeDiagnostics', () => {
  it('explains where memory, processes, and disk go', () => {
    const text = formatRuntimeDiagnostics(diagnostics())

    expect(text).toContain('Uptime:         3d 14h')
    expect(text).toContain('Daemon PID:     200')
    expect(text).toContain('Oldest session age:   9h 0m')
    expect(text).toContain('In session trees:     7')
    expect(text).toContain('Untracked under daemon: 1')
    expect(text).toContain('Terminal daemon:      50 MB')
    expect(text).toContain('Session trees:        200 MB')
    expect(text).toContain('Total Dolphin tree:      550 MB')
    expect(text).toContain('terminal-history:     2.0 MB  (4 files, 2 entries)')
    expect(text).toContain('logs:                 absent')
  })

  it('lists inconsistencies and labels a partial daemon inventory', () => {
    const text = formatRuntimeDiagnostics(
      diagnostics({
        daemonInventoryComplete: false,
        inconsistencies: [{ kind: 'registered-pty-exited', sessionId: 's1', pid: 42 }]
      })
    )

    expect(text).toContain('Daemon sessions:      2 (partial: a daemon did not answer)')
    expect(text).toContain('Inconsistencies:      1')
    expect(text).toContain('- registered-pty-exited  s1  pid 42')
  })
})

describe('formatDuration', () => {
  it('uses the two most significant units', () => {
    expect(formatDuration(59_000)).toBe('0m')
    expect(formatDuration(90 * 60_000)).toBe('1h 30m')
  })
})
