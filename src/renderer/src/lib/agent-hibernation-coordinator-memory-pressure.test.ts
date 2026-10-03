import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import type { HostMemory, MemorySnapshot } from '../../../shared/process-stats-types'
import { startAgentHibernationCoordinator } from './agent-hibernation-coordinator'
import {
  entry,
  installEligibleState,
  layout,
  LEAF,
  NOW,
  resetAgentHibernationCoordinatorFixture,
  tab
} from './agent-hibernation-coordinator-test-fixture'

const GIB = 1024 * 1024 * 1024
const RECENT = NOW - 2 * 60_000

function host(availableGiB: number): HostMemory {
  return {
    totalMemory: 16 * GIB,
    freeMemory: availableGiB * GIB,
    availableMemory: availableGiB * GIB,
    availableMemorySource: 'free-memory',
    usedMemory: (16 - availableGiB) * GIB,
    memoryUsagePercent: ((16 - availableGiB) / 16) * 100,
    cpuCoreCount: 8,
    loadAverage1m: 0
  }
}

function recentlyDone(tabId: string) {
  return {
    ...entry(),
    paneKey: `${tabId}:${LEAF}`,
    tabId,
    updatedAt: RECENT,
    stateStartedAt: RECENT,
    providerSession: { key: 'session_id' as const, id: `session-${tabId}` }
  }
}

function snapshotWithPaneMemory(
  memoryByPaneKey: Record<string, number>,
  collectedAt: number
): MemorySnapshot {
  const usage = { cpu: 0, memory: 0 }
  return {
    app: { ...usage, main: usage, renderer: usage, other: usage, history: [] },
    worktrees: [
      {
        ...usage,
        worktreeId: 'wt-bg',
        worktreeName: 'wt-bg',
        repoId: 'fixture-repo',
        repoName: 'fixture',
        history: [],
        sessions: Object.entries(memoryByPaneKey).map(([paneKey, memory]) => ({
          sessionId: paneKey,
          paneKey,
          pid: 1,
          cpu: 0,
          memory
        }))
      }
    ],
    host: host(1),
    processMemoryMetric: 'rss',
    totalCpu: 0,
    totalMemory: 0,
    collectedAt
  }
}

const getHostMemory = vi.fn<() => Promise<HostMemory | null>>()
const getSnapshot = vi.fn<() => Promise<MemorySnapshot>>()

beforeEach(() => {
  Object.assign(window.api, { memory: { getHostMemory, getSnapshot } })
})

afterEach(() => {
  resetAgentHibernationCoordinatorFixture()
  getHostMemory.mockReset()
  getSnapshot.mockReset()
  useAppStore.setState({ memorySnapshot: null })
})

async function runTwoTicks(): Promise<void> {
  startAgentHibernationCoordinator({ intervalMs: 1000, now: () => NOW })
  await vi.advanceTimersByTimeAsync(1000)
  await vi.advanceTimersByTimeAsync(1000)
}

describe('agent hibernation coordinator under host memory pressure', () => {
  it('hibernates a recently finished local agent when memory is critical', async () => {
    vi.useFakeTimers()
    getHostMemory.mockResolvedValue(host(1))
    const recent = recentlyDone('tab-1')
    const shutdown = installEligibleState(vi.fn().mockResolvedValue(undefined), {
      agentStatusByPaneKey: { [recent.paneKey]: recent }
    })

    await runTwoTicks()

    expect(shutdown).toHaveBeenCalledWith('wt-bg', expect.objectContaining({ tabId: 'tab-1' }))
  })

  it('keeps the configured window when memory is plentiful or unreadable', async () => {
    vi.useFakeTimers()
    const recent = recentlyDone('tab-1')
    for (const answer of [host(8), null]) {
      getHostMemory.mockResolvedValue(answer)
      const shutdown = installEligibleState(vi.fn().mockResolvedValue(undefined), {
        agentStatusByPaneKey: { [recent.paneKey]: recent }
      })
      await runTwoTicks()
      expect(shutdown).not.toHaveBeenCalled()
      resetAgentHibernationCoordinatorFixture()
      vi.useFakeTimers()
    }
  })

  it('does not read host memory while hibernation is disabled', async () => {
    vi.useFakeTimers()
    installEligibleState(vi.fn())
    const settings = useAppStore.getState().settings
    if (!settings) {
      throw new Error('fixture installs settings')
    }
    useAppStore.setState({ settings: { ...settings, experimentalAgentHibernation: false } })

    await runTwoTicks()

    expect(getHostMemory).not.toHaveBeenCalled()
  })

  it('drains the heaviest sessions first, reusing a fresh Resource Manager snapshot', async () => {
    vi.useFakeTimers()
    getHostMemory.mockResolvedValue(host(1))
    const light = recentlyDone('tab-1')
    const heavy = recentlyDone('tab-2')
    const shutdown = installEligibleState(vi.fn().mockResolvedValue(undefined), {
      tabsByWorktree: { 'wt-bg': [tab(), { ...tab(), id: 'tab-2', sortOrder: 1 }] },
      terminalLayoutsByTabId: {
        'tab-1': layout(),
        'tab-2': { ...layout(), ptyIdsByLeafId: { [LEAF]: 'pty-2' } }
      },
      ptyIdsByTabId: { 'tab-1': ['pty-1'], 'tab-2': ['pty-2'] },
      agentStatusByPaneKey: { [light.paneKey]: light, [heavy.paneKey]: heavy },
      memorySnapshot: snapshotWithPaneMemory({ [light.paneKey]: 10, [heavy.paneKey]: 900 }, NOW)
    })

    await runTwoTicks()

    expect(shutdown.mock.calls.map(([, target]) => target.tabId)).toEqual(['tab-2', 'tab-1'])
    expect(getSnapshot).not.toHaveBeenCalled()
  })

  it('fetches one snapshot to rank a pressured drain when the cached one is stale', async () => {
    vi.useFakeTimers()
    getHostMemory.mockResolvedValue(host(1))
    const light = recentlyDone('tab-1')
    const heavy = recentlyDone('tab-2')
    getSnapshot.mockResolvedValue(
      snapshotWithPaneMemory({ [light.paneKey]: 10, [heavy.paneKey]: 900 }, NOW)
    )
    const shutdown = installEligibleState(vi.fn().mockResolvedValue(undefined), {
      tabsByWorktree: { 'wt-bg': [tab(), { ...tab(), id: 'tab-2', sortOrder: 1 }] },
      terminalLayoutsByTabId: {
        'tab-1': layout(),
        'tab-2': { ...layout(), ptyIdsByLeafId: { [LEAF]: 'pty-2' } }
      },
      ptyIdsByTabId: { 'tab-1': ['pty-1'], 'tab-2': ['pty-2'] },
      agentStatusByPaneKey: { [light.paneKey]: light, [heavy.paneKey]: heavy },
      memorySnapshot: snapshotWithPaneMemory({}, NOW - 60 * 60_000)
    })

    await runTwoTicks()

    expect(getSnapshot).toHaveBeenCalledTimes(1)
    expect(shutdown.mock.calls.map(([, target]) => target.tabId)).toEqual(['tab-2', 'tab-1'])
  })
})
