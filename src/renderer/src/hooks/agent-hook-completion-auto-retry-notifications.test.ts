import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ParsedAgentStatusPayload } from '../../../shared/agent-status-types'
import type { StopFailureErrorKind } from '../../../shared/stop-failure-error-kind'

const dispatchTerminalNotification = vi.fn()

let mockStoreState: Record<string, unknown>
const HOOK_DONE_QUIET_MS = 1_500
const paneKey = 'tab-1:11111111-1111-4111-8111-111111111111'

vi.mock('@/store', () => ({
  useAppStore: {
    getState: () => mockStoreState
  }
}))

vi.mock('@/components/terminal-pane/use-notification-dispatch', () => ({
  dispatchTerminalNotification
}))

vi.mock('@/components/terminal-pane/agent-hook-terminal-lifecycle', () => ({
  dispatchAgentHookTerminalLifecycle: vi.fn()
}))

function claudeStatus(
  state: 'working' | 'done',
  failureKind?: StopFailureErrorKind
): ParsedAgentStatusPayload {
  return {
    state,
    prompt: 'refactor',
    agentType: 'claude',
    mainAgent: {
      state,
      ...(failureKind ? { outcome: 'failure', failureKind } : {}),
      stateStartedAt: state === 'done' ? 2 : 1
    }
  }
}

async function runTurn(failureKind?: StopFailureErrorKind): Promise<void> {
  const { observeAgentHookCompletionForNotification } =
    await import('./agent-hook-completion-notifications')
  observeAgentHookCompletionForNotification({
    paneKey,
    worktreeId: 'wt-1',
    payload: claudeStatus('working')
  })
  observeAgentHookCompletionForNotification({
    paneKey,
    worktreeId: 'wt-1',
    payload: claudeStatus('done', failureKind)
  })
  vi.advanceTimersByTime(HOOK_DONE_QUIET_MS)
}

describe('hook completion notifications during connection-loss auto-retry', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    dispatchTerminalNotification.mockClear()
    mockStoreState = {
      settings: {
        experimentalTerminalAttention: false,
        notifications: { enabled: true, agentTaskComplete: true }
      },
      ptyIdsByTabId: { 'tab-1': ['pty-1'] },
      suppressedPtyExitIds: {},
      tabsByWorktree: { 'wt-1': [{ id: 'tab-1', ptyId: 'pty-1' }] },
      terminalLayoutsByTabId: {},
      agentLaunchConfigByPaneKey: {},
      agentStatusByPaneKey: {},
      getAgentLaunchConfigForStatusEntry: () => undefined
    }
  })

  afterEach(() => vi.useRealTimers())

  it('keeps a retryable failed turn quiet while auto-retry owns it', async () => {
    await runTurn('server_error')
    expect(dispatchTerminalNotification).not.toHaveBeenCalled()
  })

  it('still notifies a non-retryable failure', async () => {
    await runTurn('rate_limit')
    expect(dispatchTerminalNotification).toHaveBeenCalledTimes(1)
  })

  it('still notifies a retryable failure when the setting is off', async () => {
    mockStoreState.settings = {
      experimentalTerminalAttention: false,
      claudeAutoRetryOnConnectionLoss: false,
      notifications: { enabled: true, agentTaskComplete: true }
    }
    await runTurn('server_error')
    expect(dispatchTerminalNotification).toHaveBeenCalledTimes(1)
  })

  it('still notifies a clean finish', async () => {
    await runTurn()
    expect(dispatchTerminalNotification).toHaveBeenCalledTimes(1)
  })
})
