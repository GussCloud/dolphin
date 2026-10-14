import './dolphin-runtime-test-lifecycle.spec'
import { describe, expect, it, vi } from 'vitest'
import type { SleepingAgentSessionRecord } from '../../shared/agent-session-resume'
import type { RuntimeStore } from './runtime-store-contract'
import { DolphinRuntimeService, makePaneKey } from './dolphin-runtime-test-mocks.spec'
import { createMobileCreateTestNotifier } from './dolphin-runtime-test-scenario-builders.spec'
import {
  HEADLESS_LEAF_ID,
  TEST_WORKTREE_ID,
  makeHeadlessTerminalLayout,
  makeRuntimeStoreWithWorkspaceSession,
  makeWorkspaceSessionWithHeadlessTerminal
} from './dolphin-runtime-test-fixtures.spec'

// Repro: the daemon died under an Agent Teams tab whose finished pane left a live sleeping record.
// Materializing that dead pane must resume the conversation, never relaunch tab.launchAgent fresh.
const PROVIDER_SESSION_ID = '2cd469fa-0000-4000-8000-000000000001'
const DEAD_SESSION_ID = 'dead-daemon-session'
const PANE_KEY = makePaneKey('host-tab', HEADLESS_LEAF_ID)

function makeRecord(
  overrides: Partial<SleepingAgentSessionRecord> = {}
): SleepingAgentSessionRecord {
  return {
    paneKey: PANE_KEY,
    tabId: 'host-tab',
    worktreeId: TEST_WORKTREE_ID,
    agent: 'claude',
    providerSession: { key: 'session_id', id: PROVIDER_SESSION_ID },
    prompt: '',
    state: 'done',
    origin: 'live',
    capturedAt: 10,
    updatedAt: 10,
    ...overrides
  }
}

const LEGACY_PANE_KEY = 'host-tab:1'

async function activateDeadAgentPane(
  record: SleepingAgentSessionRecord | null,
  opts: { recordPaneKey?: string; spawnResult?: Record<string, unknown> } = {}
): Promise<{
  spawnArgs: {
    command?: string
    sessionId?: string
    launchAgent?: string
    resumeProviderSession?: unknown
  }
  sleepingAfter: Record<string, SleepingAgentSessionRecord> | undefined
  clearRendererRecord: ReturnType<typeof vi.fn>
}> {
  const spawn = vi.fn().mockResolvedValue({ id: 'materialized-pty', ...opts.spawnResult })
  const recordPaneKey = opts.recordPaneKey ?? PANE_KEY
  const session = makeWorkspaceSessionWithHeadlessTerminal({
    tabsByWorktree: {
      [TEST_WORKTREE_ID]: [
        {
          id: 'host-tab',
          ptyId: DEAD_SESSION_ID,
          worktreeId: TEST_WORKTREE_ID,
          title: '✳ Agent Teams',
          customTitle: null,
          color: null,
          sortOrder: 0,
          createdAt: 1,
          launchAgent: 'claude-agent-teams'
        }
      ]
    },
    terminalLayoutsByTabId: {
      'host-tab': makeHeadlessTerminalLayout({ [HEADLESS_LEAF_ID]: DEAD_SESSION_ID })
    },
    sleepingAgentSessionsByPaneKey: record
      ? { [recordPaneKey]: { ...record, paneKey: recordPaneKey } }
      : {}
  })
  const { runtimeStore, getSession } = makeRuntimeStoreWithWorkspaceSession(session)
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: The shared fixture supplies RuntimeStore methods; its legacy Mock return type loses callable signatures.
  const runtime = new DolphinRuntimeService(runtimeStore as RuntimeStore)
  const clearRendererRecord = vi.fn()
  runtime.setNotifier({
    ...createMobileCreateTestNotifier(vi.fn()),
    resolveLegacyWorkerTerminalRecovery: clearRendererRecord
  })
  runtime.setPtyController({
    spawn,
    write: () => true,
    kill: () => true,
    getForegroundProcess: async () => null,
    listProcesses: async () => []
  })
  runtime.syncWindowGraph(0, { tabs: [], leaves: [] })

  await runtime.activateMobileSessionTab(
    `id:${TEST_WORKTREE_ID}`,
    `host-tab::${HEADLESS_LEAF_ID}`,
    undefined,
    { notifyClients: false }
  )

  expect(spawn).toHaveBeenCalledTimes(1)
  return {
    spawnArgs: spawn.mock.calls[0][0],
    sleepingAfter: getSession().sleepingAgentSessionsByPaneKey,
    clearRendererRecord
  }
}

describe('mobile activation of a dead agent pane with a sleeping record', () => {
  it('resumes the recorded provider session instead of a fresh launchAgent launch', async () => {
    const { spawnArgs, sleepingAfter, clearRendererRecord } =
      await activateDeadAgentPane(makeRecord())

    expect(spawnArgs.sessionId).toBe(DEAD_SESSION_ID)
    expect(spawnArgs.command).toContain('--resume')
    expect(spawnArgs.command).toContain(PROVIDER_SESSION_ID)
    // Agent Teams launch shape is platform-specific: win32 `--teammate-mode`, posix `claude-teams` shim.
    expect(spawnArgs.command).not.toMatch(/--teammate-mode|claude-teams/)
    expect(spawnArgs.resumeProviderSession).toEqual({
      key: 'session_id',
      id: PROVIDER_SESSION_ID
    })
    expect(sleepingAfter?.[PANE_KEY]).toBeUndefined()
    // The renderer patches its whole sleeping map back; it must drop its copy too.
    expect(clearRendererRecord).toHaveBeenCalledWith(PANE_KEY, 'adopted')
  })

  it('keeps the record when the create attached a still-live session', async () => {
    const { sleepingAfter, clearRendererRecord } = await activateDeadAgentPane(makeRecord(), {
      spawnResult: { reattachedLiveSession: true }
    })

    expect(sleepingAfter?.[PANE_KEY]).toBeDefined()
    expect(clearRendererRecord).not.toHaveBeenCalled()
  })

  it('replays the record launchConfig args on resume', async () => {
    const { spawnArgs } = await activateDeadAgentPane(
      makeRecord({ launchConfig: { agentArgs: '--model opus-recorded', agentEnv: {} } })
    )

    expect(spawnArgs.command).toContain('--resume')
    expect(spawnArgs.command).toContain("'--model' 'opus-recorded'")
  })

  it('materializes an untagged plain shell when the record names another execution host', async () => {
    const { spawnArgs, sleepingAfter, clearRendererRecord } = await activateDeadAgentPane(
      makeRecord({ connectionId: 'ssh-other-host' })
    )

    expect(spawnArgs.sessionId).toBe(DEAD_SESSION_ID)
    expect(spawnArgs.command).toBeUndefined()
    expect(spawnArgs.launchAgent).toBeUndefined()
    expect(sleepingAfter?.[PANE_KEY]).toBeDefined()
    expect(clearRendererRecord).not.toHaveBeenCalled()
  })

  it('materializes a plain shell when only a legacy-keyed record exists for the tab', async () => {
    const { spawnArgs } = await activateDeadAgentPane(makeRecord(), {
      recordPaneKey: LEGACY_PANE_KEY
    })

    expect(spawnArgs.command).toBeUndefined()
  })

  it('keeps the fresh launchAgent launch when the pane has no sleeping record', async () => {
    const { spawnArgs } = await activateDeadAgentPane(null)

    expect(spawnArgs.command).toMatch(/--teammate-mode|claude-teams/)
    expect(spawnArgs.command).not.toContain('--resume')
  })
})
