import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EnrichedAgentHookEventPayload } from '../agent-hooks/server/server-types'
import type { AgentStatusClearIpcPayload } from '../../shared/agent-status-types'
import type { StopFailureErrorKind } from '../../shared/stop-failure-error-kind'
import type { AgentPaneTextResult } from '../agent-pane-text-delivery'
import {
  createAutoRetryDoneNoticeFilter,
  startClaudeConnectionLossRetry,
  type ClaudeConnectionLossExhaustedEvent
} from './claude-connection-loss-retry'

const PANE = 'tab-1:11111111-1111-4111-8111-111111111111'

type HarnessContext = {
  enabled: boolean
  terminal: string | null
  lastInputAt: number | undefined
  results: AgentPaneTextResult[]
  sent: { terminal: string; text: string }[]
  exhausted: ClaudeConnectionLossExhaustedEvent[]
}

type EmitOptions = {
  failureKind?: StopFailureErrorKind
  toolAgentId?: string
  isReplay?: boolean
  source?: EnrichedAgentHookEventPayload['source']
  outcome?: 'failure' | 'success'
  restate?: boolean
  prompt?: string
  mainAgentState?: 'working' | 'done'
}

function harness() {
  let statusListener: (payload: EnrichedAgentHookEventPayload) => void = () => {}
  let dropListener: (paneKey: string) => void = () => {}
  let clearListener: (clear: AgentStatusClearIpcPayload) => void = () => {}
  const ctx: HarnessContext = {
    enabled: true,
    terminal: 'term-1',
    lastInputAt: undefined,
    results: [],
    sent: [],
    exhausted: []
  }
  const dispose = startClaudeConnectionLossRetry({
    subscribeEnrichedStatus: (listener) => {
      statusListener = listener
      return () => {}
    },
    subscribeStatusDrop: (listener) => {
      dropListener = listener
      return () => {}
    },
    subscribePaneStatusClear: (listener) => {
      clearListener = listener
      return () => {}
    },
    isEnabled: () => ctx.enabled,
    resolveTerminalHandle: () => ctx.terminal,
    readLastInputAt: () => ctx.lastInputAt,
    sendText: async (terminal, text) => {
      ctx.sent.push({ terminal, text })
      return ctx.results.shift() ?? 'accepted'
    },
    notifyExhausted: (event) => ctx.exhausted.push(event)
  })
  let clock = 1_000
  const emit = (hookEventName: string, options: EmitOptions = {}): void => {
    if (!options.restate) {
      clock += 1
    }
    const isFailure = hookEventName === 'StopFailure'
    const done =
      options.mainAgentState !== undefined
        ? options.mainAgentState === 'done'
        : isFailure || hookEventName === 'Stop'
    statusListener({
      paneKey: PANE,
      worktreeId: 'wt-1',
      connectionId: 'conn-1',
      source: options.source ?? 'claude',
      hookEventName,
      ...(options.toolAgentId ? { toolAgentId: options.toolAgentId } : {}),
      ...(options.isReplay ? { isReplay: true } : {}),
      receivedAt: clock,
      stateStartedAt: clock,
      payload: {
        state: done ? 'done' : 'working',
        prompt: options.prompt ?? 'p',
        agentType: 'claude',
        mainAgent: {
          state: done ? 'done' : 'working',
          ...(isFailure ? { outcome: options.outcome ?? 'failure' } : {}),
          ...(isFailure && options.failureKind !== undefined
            ? { failureKind: options.failureKind }
            : {}),
          stateStartedAt: clock
        }
      }
    })
  }
  return {
    ctx,
    emit,
    fail: (failureKind: StopFailureErrorKind = 'server_error') =>
      emit('StopFailure', { failureKind }),
    /** The UserPromptSubmit our own `continue` produces. */
    ownPrompt: () => emit('UserPromptSubmit', { prompt: 'continue' }),
    userPrompt: () => emit('UserPromptSubmit', { prompt: 'do the thing' }),
    drop: () => dropListener(PANE),
    clear: () => clearListener({ paneKey: PANE }),
    disconnect: (connectionId = 'conn-1') =>
      clearListener({ transient: true, connectionId, clearedAt: clock }),
    dispose
  }
}

async function advance(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms)
}

describe('Claude connection-loss auto-retry', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('types continue after 5s, 15s and 45s, then notifies once when retries are exhausted', async () => {
    const h = harness()
    h.userPrompt()
    h.fail()
    await advance(4_999)
    expect(h.ctx.sent).toEqual([])
    await advance(1)
    expect(h.ctx.sent).toEqual([{ terminal: 'term-1', text: 'continue' }])

    // Our own continue starts the next attempt without resetting the budget.
    h.ownPrompt()
    h.fail()
    await advance(14_999)
    expect(h.ctx.sent).toHaveLength(1)
    await advance(1)
    expect(h.ctx.sent).toHaveLength(2)

    h.ownPrompt()
    h.fail()
    await advance(45_000)
    expect(h.ctx.sent).toHaveLength(3)

    h.ownPrompt()
    h.fail()
    await advance(120_000)
    expect(h.ctx.sent).toHaveLength(3)
    expect(h.ctx.exhausted).toEqual([{ paneKey: PANE, worktreeId: 'wt-1', attempts: 3 }])
  })

  it('a clean Stop resets the budget for the next failure', async () => {
    const h = harness()
    h.fail()
    await advance(5_000)
    h.ownPrompt()
    h.emit('Stop')
    h.userPrompt()
    h.fail()
    await advance(5_000)
    expect(h.ctx.sent).toHaveLength(2)
    expect(h.ctx.exhausted).toEqual([])
  })

  it('a prompt the user typed resets the budget', async () => {
    const h = harness()
    h.fail()
    await advance(5_000)
    h.ownPrompt()
    h.fail()
    await advance(15_000)
    expect(h.ctx.sent).toHaveLength(2)
    h.ownPrompt()
    h.userPrompt()
    h.fail()
    await advance(5_000)
    expect(h.ctx.sent).toHaveLength(3)
  })

  it('a non-matching prompt clears the own-prompt flag instead of being swallowed', async () => {
    const h = harness()
    h.fail()
    await advance(5_000)
    // Our continue never produced a prompt; the user's real one must reset the budget.
    h.userPrompt()
    h.fail()
    await advance(5_000)
    expect(h.ctx.sent).toHaveLength(2)
    h.ownPrompt()
    h.fail()
    // The budget restarted at the user's prompt, so this is attempt 2 (15s), not 3 (45s).
    await advance(15_000)
    expect(h.ctx.sent).toHaveLength(3)
  })

  it('cancels silently when the user typed since the failure', async () => {
    const h = harness()
    h.ctx.lastInputAt = 10
    h.fail()
    h.ctx.lastInputAt = 20
    await advance(60_000)
    expect(h.ctx.sent).toEqual([])
    expect(h.ctx.exhausted).toEqual([])
  })

  it('cancels when the lead resumes work, a Stop or a SessionStart arrives', async () => {
    const h = harness()
    h.fail()
    h.emit('PreToolUse', { mainAgentState: 'working' })
    await advance(60_000)
    h.fail()
    h.emit('Stop')
    await advance(60_000)
    h.fail()
    h.emit('SessionStart', { mainAgentState: 'done' })
    await advance(60_000)
    expect(h.ctx.sent).toEqual([])
    expect(h.ctx.exhausted).toEqual([])
  })

  it('keeps the timer through child traffic, a teammate idle and other lead restatements', async () => {
    const h = harness()
    h.fail()
    h.emit('PostToolUse', { toolAgentId: 'agent-1' })
    h.emit('TeammateIdle', { mainAgentState: 'done' })
    h.emit('SubagentStop', { mainAgentState: 'done' })
    h.emit('PostCompact', { mainAgentState: 'done' })
    h.emit('StopFailure', { failureKind: 'server_error', isReplay: true })
    h.emit('Stop', { source: 'codex' })
    await advance(5_000)
    expect(h.ctx.sent).toHaveLength(1)

    const child = harness()
    child.emit('StopFailure', { failureKind: 'server_error', toolAgentId: 'agent-1' })
    await advance(60_000)
    expect(child.ctx.sent).toEqual([])
  })

  it('a restated failure row is not a new failure', async () => {
    const h = harness()
    h.fail()
    await advance(2_000)
    // Same main-agent stamp: e.g. a child-work fold re-publishing the row keeps the timer.
    h.emit('StopFailure', { failureKind: 'server_error', restate: true })
    await advance(3_000)
    expect(h.ctx.sent).toHaveLength(1)
  })

  it.each<StopFailureErrorKind>([
    'rate_limit',
    'authentication_failed',
    'billing_error',
    'invalid_request',
    'max_output_tokens'
  ])('never retries a %s failure', async (kind) => {
    const h = harness()
    h.fail(kind)
    await advance(60_000)
    expect(h.ctx.sent).toEqual([])
    expect(h.ctx.exhausted).toEqual([])
  })

  it('retries an unknown failure but not one an older host left unclassified', async () => {
    const h = harness()
    h.fail('unknown')
    await advance(5_000)
    expect(h.ctx.sent).toHaveLength(1)

    const old = harness()
    old.emit('StopFailure')
    await advance(60_000)
    expect(old.ctx.sent).toEqual([])
  })

  it('does nothing when the setting is off, and re-checks it before sending', async () => {
    const h = harness()
    h.ctx.enabled = false
    h.fail()
    await advance(60_000)
    expect(h.ctx.sent).toEqual([])

    h.ctx.enabled = true
    h.userPrompt()
    h.fail()
    h.ctx.enabled = false
    await advance(60_000)
    expect(h.ctx.sent).toEqual([])
    expect(h.ctx.exhausted).toEqual([])
  })

  it.each<AgentPaneTextResult>(['no-agent', 'rejected', 'unknown', 'permission', 'partly-sent'])(
    'hands the turn back with an exhausted notice when the send is %s',
    async (result) => {
      const h = harness()
      h.ctx.results = [result]
      h.fail()
      await advance(5_000)
      expect(h.ctx.exhausted).toEqual([{ paneKey: PANE, worktreeId: 'wt-1', attempts: 1 }])
      h.userPrompt()
      h.fail()
      await advance(60_000)
      expect(h.ctx.sent).toHaveLength(2)
    }
  )

  it('notifies immediately when the pane has no live terminal to retry in', async () => {
    const h = harness()
    h.ctx.terminal = null
    h.fail()
    expect(h.ctx.exhausted).toEqual([{ paneKey: PANE, worktreeId: 'wt-1', attempts: 0 }])
    await advance(60_000)
    expect(h.ctx.sent).toEqual([])
  })

  it('notifies when the live terminal is gone by the time the retry fires', async () => {
    const h = harness()
    h.fail()
    h.ctx.terminal = null
    await advance(5_000)
    expect(h.ctx.sent).toEqual([])
    expect(h.ctx.exhausted).toEqual([{ paneKey: PANE, worktreeId: 'wt-1', attempts: 0 }])
  })

  it('a user dismissal during backoff cancels silently', async () => {
    const h = harness()
    h.fail()
    h.drop()
    await advance(60_000)
    expect(h.ctx.sent).toEqual([])
    expect(h.ctx.exhausted).toEqual([])
  })

  it('a host disconnect notifies panes on that connection only', async () => {
    const h = harness()
    h.fail()
    h.disconnect('conn-other')
    await advance(5_000)
    expect(h.ctx.sent).toHaveLength(1)

    h.ownPrompt()
    h.fail()
    h.disconnect()
    await advance(60_000)
    expect(h.ctx.sent).toHaveLength(1)
    expect(h.ctx.exhausted).toEqual([{ paneKey: PANE, worktreeId: 'wt-1', attempts: 1 }])
  })

  it('closing the pane or its worktree cancels silently', async () => {
    const h = harness()
    h.fail()
    h.clear()
    await advance(60_000)
    expect(h.ctx.sent).toEqual([])
    expect(h.ctx.exhausted).toEqual([])
  })

  it('dispose cancels pending retries', async () => {
    const h = harness()
    h.fail()
    h.dispose()
    await advance(60_000)
    expect(h.ctx.sent).toEqual([])
  })

  it('the Telegram filter holds only the done notice of a retryable failure while enabled', () => {
    let enabled = true
    const filter = createAutoRetryDoneNoticeFilter(() => enabled)
    const entry = (failureKind?: StopFailureErrorKind) => ({
      paneKey: PANE,
      state: 'done' as const,
      prompt: 'p',
      updatedAt: 1,
      stateStartedAt: 1,
      stateHistory: [],
      mainAgent: {
        state: 'done' as const,
        ...(failureKind ? { outcome: 'failure' as const, failureKind } : {}),
        stateStartedAt: 1
      }
    })
    const done = { kind: 'done' as const, text: 'Done', buttons: [] }
    const waiting = { kind: 'waiting' as const, text: 'Waiting', buttons: [] }
    expect(filter(done, entry('server_error'))).toBe(false)
    expect(filter(waiting, entry('server_error'))).toBe(true)
    expect(filter(done, entry('rate_limit'))).toBe(true)
    expect(filter(done, entry())).toBe(true)
    enabled = false
    expect(filter(done, entry('server_error'))).toBe(true)
  })
})
