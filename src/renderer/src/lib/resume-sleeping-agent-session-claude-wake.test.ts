import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SleepingAgentSessionRecord } from '../../../shared/agent-session-resume'
import { makePaneKey } from '../../../shared/stable-pane-id'
import { useAppStore } from '@/store'
import { resumeSleepingAgentSessionsForWorktree } from './resume-sleeping-agent-session'

const initialAppStoreState = useAppStore.getState()
const LEAF_ID = '33333333-3333-4333-8333-333333333333'

afterEach(() => {
  vi.unstubAllGlobals()
  useAppStore.setState(initialAppStoreState, true)
})

function makeRecord(
  overrides: Partial<SleepingAgentSessionRecord> = {}
): SleepingAgentSessionRecord {
  return {
    paneKey: makePaneKey('tab-1', LEAF_ID),
    tabId: 'tab-1',
    worktreeId: 'wt-1',
    agent: 'claude',
    providerSession: { key: 'session_id', id: 'sess-1' },
    prompt: 'finish the task',
    state: 'working',
    capturedAt: 1,
    updatedAt: 1,
    origin: 'worktree-sleep',
    ...overrides
  }
}

function makeTerminalTab(id: string, worktreeId: string): Record<string, unknown> {
  return {
    id,
    ptyId: null,
    worktreeId,
    title: 'shell',
    customTitle: null,
    color: null,
    sortOrder: 0,
    createdAt: 1
  }
}

function makeLayout(leafId: string, ptyId = 'pty-1'): Record<string, unknown> {
  return {
    root: { type: 'leaf', leafId },
    activeLeafId: leafId,
    expandedLeafId: null,
    ptyIdsByLeafId: { [leafId]: ptyId }
  }
}

// Requirement: a finished Claude pane must survive the activation sweep so its own pane can
// cold-restore `claude --resume` in place when it mounts.
describe('activation sweep keeps finished Claude panes resumable in place', () => {
  function seed(
    record: SleepingAgentSessionRecord,
    opts: { activeWorktreeId: string | null; layout: boolean }
  ): void {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: fixture tabs/layouts carry only the fields the sweep reads.
    useAppStore.setState({
      activeWorktreeId: opts.activeWorktreeId,
      tabsByWorktree: { 'wt-1': [makeTerminalTab('tab-1', 'wt-1')] },
      terminalLayoutsByTabId: opts.layout ? { 'tab-1': makeLayout(LEAF_ID) } : {},
      ptyIdsByTabId: {},
      sleepingAgentSessionsByPaneKey: { [record.paneKey]: record }
    } as never)
  }

  it.each([
    [
      'manual sleep (worktree-sleep, lazy)',
      { origin: 'worktree-sleep', restoreOnTabOpenOnly: true }
    ],
    ['daemon death (live checkpoint)', { origin: 'live' }]
  ] as const)('keeps a done %s record on an inactive workspace', (_label, overrides) => {
    const record = makeRecord({ state: 'done', ...overrides })
    seed(record, { activeWorktreeId: 'wt-other', layout: true })

    expect(resumeSleepingAgentSessionsForWorktree('wt-1')).toBe(0)
    expect(useAppStore.getState().sleepingAgentSessionsByPaneKey[record.paneKey]).toBe(record)
    expect(useAppStore.getState().tabsByWorktree['wt-1']).toHaveLength(1)
  })

  it('keeps a manually slept working record owned by its preserved pane on wake', () => {
    const record = makeRecord({ state: 'working', origin: 'worktree-sleep' })
    seed(record, { activeWorktreeId: 'wt-1', layout: true })

    expect(resumeSleepingAgentSessionsForWorktree('wt-1')).toBe(0)
    expect(useAppStore.getState().sleepingAgentSessionsByPaneKey[record.paneKey]).toBe(record)
    expect(useAppStore.getState().tabsByWorktree['wt-1']).toHaveLength(1)
  })

  // Documents the edge: without a persisted layout leaf no pane can claim the record, and the
  // passive record is discarded instead of reopened in a new tab.
  it('drops a done live checkpoint whose tab layout no longer holds its leaf', () => {
    const record = makeRecord({ state: 'done', origin: 'live' })
    seed(record, { activeWorktreeId: 'wt-1', layout: false })

    expect(resumeSleepingAgentSessionsForWorktree('wt-1')).toBe(0)
    expect(useAppStore.getState().sleepingAgentSessionsByPaneKey[record.paneKey]).toBeUndefined()
  })
})
