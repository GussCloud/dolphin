import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setAppEnvironment } from '../../shared/app-environment'
import { toAppSshPtyId } from '../../shared/ssh-pty-id'
import type { MemorySnapshot } from '../../shared/process-stats-types'

const { listRegisteredPtysMock } = vi.hoisted(() => ({ listRegisteredPtysMock: vi.fn() }))
vi.mock('../memory/pty-registry', () => ({ listRegisteredPtys: listRegisteredPtysMock }))

import { collectRuntimeDiagnostics } from './runtime-diagnostics'

const LOCAL_ID = 'repo-1::/work/tree@@aaaa1111'
const CLOSED_ID = 'repo-1::/work/tree@@bbbb2222'
const SSH_ID = toAppSshPtyId('conn-1', 'pty-7')

const emptySnapshot = {
  app: {
    cpu: 0,
    memory: 0,
    main: { cpu: 0, memory: 0 },
    renderer: { cpu: 0, memory: 0 },
    other: { cpu: 0, memory: 0 },
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
  totalMemory: 0,
  collectedAt: 0
} satisfies MemorySnapshot

describe('collectRuntimeDiagnostics', () => {
  let userData: string

  beforeEach(async () => {
    userData = await mkdtemp(join(tmpdir(), 'dolphin-runtime-diag-'))
    setAppEnvironment({
      getPath: () => userData,
      getAppPath: () => userData,
      getVersion: () => '9.9.9',
      isPackaged: () => false,
      onWillQuit: () => {},
      exit: () => {},
      getAppMetrics: () => []
    })
    listRegisteredPtysMock.mockReturnValue([])
  })

  afterEach(async () => {
    await rm(userData, { recursive: true, force: true })
  })

  it('reports only local saved tabs that can neither reattach nor cold-restore', async () => {
    const result = await collectRuntimeDiagnostics({
      getMemorySnapshot: async () => emptySnapshot,
      listDaemonSessions: async () => ({ sessions: [], complete: true }),
      readDaemonPid: () => null,
      isDaemonDegraded: () => false,
      readLocalPersistedWorkspaceSession: () => [
        {
          tabsByWorktree: { w: [{ ptyId: LOCAL_ID }, { ptyId: SSH_ID }, { ptyId: 'remote:x' }] },
          closedTerminalTabTombstonesByTabId: { t: { ptyId: CLOSED_ID } }
        }
      ],
      listRestorableSessionIds: async () => new Set()
    })

    expect(result.runtime.appVersion).toBe('9.9.9')
    expect(result.sessions.inconsistencies).toEqual([
      { kind: 'saved-tab-session-unavailable', sessionId: LOCAL_ID, pid: null }
    ])
    expect(result.sessions.matchedSessionCount).toBe(0)
  })

  it('reports the host heap and the daemon heap, tolerating a daemon that cannot answer', async () => {
    const daemonHeap = {
      rssBytes: 10,
      heapUsedBytes: 5,
      heapTotalBytes: 8,
      externalBytes: 1,
      arrayBuffersBytes: 0
    }
    const base = {
      getMemorySnapshot: async () => emptySnapshot,
      listDaemonSessions: async () => ({ sessions: [], complete: true }),
      readDaemonPid: () => null,
      isDaemonDegraded: () => false
    }

    const answered = await collectRuntimeDiagnostics({
      ...base,
      readDaemonHeap: async () => daemonHeap
    })
    expect(answered.heap?.daemon).toEqual(daemonHeap)
    expect(answered.heap?.host.heapUsedBytes).toBeGreaterThan(0)

    const failed = await collectRuntimeDiagnostics({
      ...base,
      readDaemonHeap: async () => {
        throw new Error('daemon gone')
      }
    })
    expect(failed.heap?.daemon).toBeNull()
    expect((await collectRuntimeDiagnostics(base)).heap?.daemon).toBeNull()
  })
})
