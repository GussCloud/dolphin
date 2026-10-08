import { describe, expect, it } from 'vitest'
import type { AgentStatusEntry } from '../../shared/agent-status-types'
import {
  TelegramNoticeTransitions,
  telegramStatusEntryFromEnriched,
  type TelegramOpenNotice
} from './telegram-notice-transitions'

const PANE = 'tab-1:11111111-1111-4111-8111-111111111111'

function entry(
  state: AgentStatusEntry['state'],
  stateStartedAt: number,
  overrides: Partial<AgentStatusEntry> = {}
): AgentStatusEntry {
  return {
    state,
    stateStartedAt,
    prompt: '',
    updatedAt: stateStartedAt,
    paneKey: PANE,
    stateHistory: [],
    ...overrides
  }
}

const OPEN: TelegramOpenNotice = {
  kind: 'waiting',
  text: 'q',
  messages: [{ chatId: 1, messageId: 9 }]
}

describe('TelegramNoticeTransitions', () => {
  it('notifies once per new state and ignores repeated pings of the same state', () => {
    const t = new TelegramNoticeTransitions()
    expect(t.observe(entry('working', 1), 1_000)).toEqual({})
    expect(t.observe(entry('waiting', 2), 10_000)).toEqual({ notify: 'waiting' })
    expect(t.observe(entry('waiting', 2), 11_000)).toEqual({})
  })

  it('resolves the open notice when the pane leaves waiting', () => {
    const t = new TelegramNoticeTransitions()
    t.observe(entry('working', 1), 1_000)
    t.observe(entry('waiting', 2), 10_000)
    t.recordSent(PANE, 2, OPEN)
    expect(t.observe(entry('working', 3), 20_000)).toEqual({ resolve: OPEN })
    expect(t.observe(entry('done', 4), 30_000)).toEqual({ notify: 'done' })
  })

  it('ignores a recordSent for a state the pane already left', () => {
    const t = new TelegramNoticeTransitions()
    t.observe(entry('working', 1), 1_000)
    t.observe(entry('waiting', 2), 10_000)
    t.observe(entry('working', 3), 11_000)
    t.recordSent(PANE, 2, OPEN)
    expect(t.observe(entry('done', 4), 30_000)).toEqual({ notify: 'done' })
  })

  it('skips session-boundary dones and a done with no observed turn', () => {
    const t = new TelegramNoticeTransitions()
    expect(t.observe(entry('done', 1, { sessionBoundary: true }), 1_000)).toEqual({})
    expect(t.observe(entry('done', 2), 10_000)).toEqual({})
    const fresh = new TelegramNoticeTransitions()
    expect(fresh.observe(entry('done', 5), 1_000)).toEqual({})
  })

  it('treats hydrated rows as baseline, never as notices', () => {
    const t = new TelegramNoticeTransitions()
    expect(t.observe(entry('waiting', 1, { restoredUnconfirmed: true }), 1_000)).toEqual({})
    expect(t.observe(entry('waiting', 1), 2_000)).toEqual({})
  })

  it('applies the shared burst cooldown per pane and kind', () => {
    const t = new TelegramNoticeTransitions()
    t.observe(entry('working', 1), 1_000)
    expect(t.observe(entry('waiting', 2), 10_000)).toEqual({ notify: 'waiting' })
    t.observe(entry('working', 3), 10_500)
    expect(t.observe(entry('waiting', 4), 11_000)).toEqual({})
    t.observe(entry('working', 5), 20_000)
    expect(t.observe(entry('waiting', 6), 20_001)).toEqual({ notify: 'waiting' })
  })

  it('refreshes the baseline from a replay without notifying', () => {
    const t = new TelegramNoticeTransitions()
    t.observe(entry('working', 1), 1_000)
    expect(t.observe(entry('waiting', 2), 10_000, true)).toEqual({})
    expect(t.observe(entry('waiting', 2), 11_000)).toEqual({})
  })

  it('forgets a pane so its next row is a first sighting', () => {
    const t = new TelegramNoticeTransitions()
    t.observe(entry('working', 1), 1_000)
    t.forget(PANE)
    expect(t.observe(entry('done', 2), 10_000)).toEqual({})
  })
})

describe('telegramStatusEntryFromEnriched', () => {
  it('keeps SSH identity and derives the completed summary from a done row', () => {
    const result = telegramStatusEntryFromEnriched({
      paneKey: PANE,
      connectionId: 'ssh-1',
      worktreeId: 'repo::/w',
      terminalHandle: 'term-1',
      receivedAt: 5,
      stateStartedAt: 4,
      payload: { state: 'done', prompt: 'p', agentType: 'claude', lastAssistantMessage: 'all good' }
    })
    expect(result).toMatchObject({
      paneKey: PANE,
      connectionId: 'ssh-1',
      worktreeId: 'repo::/w',
      terminalHandle: 'term-1',
      lastCompletedAssistantMessage: 'all good',
      updatedAt: 5,
      stateStartedAt: 4
    })
  })

  it('does not treat tool output as a completed summary', () => {
    const result = telegramStatusEntryFromEnriched({
      paneKey: PANE,
      connectionId: null,
      receivedAt: 5,
      stateStartedAt: 4,
      restoredUnconfirmed: true,
      payload: {
        state: 'done',
        prompt: '',
        lastAssistantMessage: 'x',
        lastAssistantMessageIsToolOutput: true
      }
    })
    expect(result.lastCompletedAssistantMessage).toBeUndefined()
    expect(result.restoredUnconfirmed).toBe(true)
  })
})
