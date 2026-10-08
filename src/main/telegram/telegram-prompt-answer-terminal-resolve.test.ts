import { describe, expect, it } from 'vitest'
import type { AgentStatusEntry } from '../../shared/agent-status-types'
import { telegramAnswerText } from './telegram-answer-text'
import type { TelegramPaneRoute, TelegramNotice } from './telegram-inbound'
import {
  createTelegramPromptAnswerService,
  type TelegramPromptAnswerPorts
} from './telegram-prompt-answer-service'
import { createTelegramPromptButtonDecorator } from './telegram-prompt-buttons'

// Local hook rows reach the store without a terminal handle; the runtime supplies it per pane.
const PANE = 'tab-1:leaf-1'
const COLOR = JSON.stringify({
  questions: [{ question: 'Color?', options: [{ label: 'Red' }, { label: 'Blue' }] }]
})
const APPROVAL = JSON.stringify({ approval: { tool: 'Bash', summary: 'rm -rf' } })

function hookEntry(overrides: Partial<AgentStatusEntry> = {}): AgentStatusEntry {
  return {
    state: 'waiting',
    prompt: 'go',
    updatedAt: 10,
    stateStartedAt: 5,
    paneKey: PANE,
    agentType: 'claude',
    toolName: 'AskUserQuestion',
    stateHistory: [],
    ...overrides
  }
}

function harness(entry: AgentStatusEntry, liveHandle: string | undefined) {
  const sent: { terminal: string; text?: string; enter: boolean }[] = []
  const resolved: string[] = []
  const ports: TelegramPromptAnswerPorts = {
    readEntry: (paneKey) => (paneKey === entry.paneKey ? entry : null),
    readStructuredPrompt: () => null,
    sendTerminal: async (input) => {
      sent.push(input)
      return 'accepted'
    },
    respondStructured: async () => 'rejected',
    sendStructuredMessage: async () => 'rejected',
    inferQuestionAnswered: () => undefined,
    resolveTerminalHandle: (paneKey) => {
      resolved.push(paneKey)
      return liveHandle
    },
    wait: async () => undefined
  }
  const service = createTelegramPromptAnswerService(ports)
  const notice: TelegramNotice = { kind: 'waiting', text: '', buttons: [] }
  const actions = createTelegramPromptButtonDecorator(() => null)(notice, entry)
    .buttons.flat()
    .map((button) => button.action)
  // The notice's route was built from the same handle-less row.
  const route: TelegramPaneRoute = {
    routeId: 'r1',
    paneKey: PANE,
    interactivePrompt: entry.interactivePrompt
  }
  const tap = (action: string) =>
    service.handleCallback!({ chatId: 1, messageId: 2, callbackQueryId: 'q', route, action })
  const reply = (text: string) => service.handleText!({ chatId: 1, messageId: 1, text, route })
  return { sent, resolved, actions, tap, reply }
}

describe('Telegram answers for a pane whose status row has no terminal handle', () => {
  it('answers a question through the live handle the runtime resolves', async () => {
    const h = harness(hookEntry({ interactivePrompt: COLOR }), 'term-live')
    expect(await h.tap(h.actions[1]!)).toEqual({ ok: true, ack: telegramAnswerText.sent() })
    expect(h.sent).toEqual([{ terminal: 'term-live', text: '2', enter: false }])
    expect(h.resolved).toEqual([PANE])
  })

  it('answers an approval through the live handle', async () => {
    const h = harness(
      hookEntry({ state: 'blocked', interactivePrompt: APPROVAL, toolName: 'Bash' }),
      'term-live'
    )
    expect(await h.tap(h.actions[0]!)).toMatchObject({ ok: true })
    expect(h.sent).toEqual([{ terminal: 'term-live', text: '1', enter: false }])
  })

  it('pastes a plain text reply into the live handle', async () => {
    const h = harness(hookEntry({ state: 'done', toolName: undefined }), 'term-live')
    expect(await h.reply('run the tests')).toEqual({ ok: true, ack: telegramAnswerText.sent() })
    expect(h.sent.map((input) => input.terminal)).toEqual(['term-live', 'term-live'])
  })

  it('still reports no terminal when the pane has no live terminal', async () => {
    const question = harness(hookEntry({ interactivePrompt: COLOR }), undefined)
    expect(await question.tap(question.actions[0]!)).toEqual({
      ok: false,
      error: telegramAnswerText.noTerminal()
    })
    const text = harness(hookEntry({ state: 'done', toolName: undefined }), undefined)
    expect(await text.reply('hello')).toEqual({
      ok: false,
      error: telegramAnswerText.noTerminal()
    })
    expect([...question.sent, ...text.sent]).toEqual([])
  })

  it('prefers a handle the row already carries over a runtime lookup', async () => {
    const h = harness(hookEntry({ interactivePrompt: COLOR, terminalHandle: 'term-row' }), 'x')
    await h.tap(h.actions[0]!)
    expect(h.sent).toEqual([{ terminal: 'term-row', text: '1', enter: false }])
    expect(h.resolved).toEqual([])
  })
})
