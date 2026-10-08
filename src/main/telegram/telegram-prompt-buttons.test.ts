import { describe, expect, it } from 'vitest'
import type { AgentStatusEntry } from '../../shared/agent-status-types'
import type { AgentJournalRenderItem } from '../../shared/agent-session-journal-types'
import {
  structuredAgentSessionPaneKey,
  structuredAgentSessionTabId
} from '../../shared/structured-agent-session-projection'
import {
  decodeTelegramPromptAction,
  encodeTelegramPromptAction,
  type TelegramStructuredPromptSnapshot
} from './telegram-answerable-prompt'
import { telegramAnswerText } from './telegram-answer-text'
import { createTelegramPromptButtonDecorator } from './telegram-prompt-buttons'
import type { TelegramNotice } from './telegram-inbound'

function entry(overrides: Partial<AgentStatusEntry> = {}): AgentStatusEntry {
  return {
    state: 'waiting',
    prompt: 'do it',
    updatedAt: 1,
    stateStartedAt: 1,
    paneKey: 'tab-1:leaf-1',
    terminalHandle: 'term-1',
    agentType: 'claude',
    stateHistory: [],
    ...overrides
  }
}

const notice: TelegramNotice = { kind: 'waiting', text: '<b>wt</b> aguardando', buttons: [] }
const noStructured = (): TelegramStructuredPromptSnapshot | null => null
const decorate = createTelegramPromptButtonDecorator(noStructured)
const ROUTE_ID = 'Ab3dE6gH9k' // longest allowed route id

function ask(questions: unknown[]): string {
  return JSON.stringify({ questions })
}

function callbackBytes(action: string): number {
  return Buffer.byteLength(`${ROUTE_ID}:${action}`, 'utf8')
}

describe('createTelegramPromptButtonDecorator', () => {
  it('leaves done notices and panes without a prompt untouched', () => {
    expect(decorate({ ...notice, kind: 'done' }, entry({ interactivePrompt: ask([]) }))).toEqual({
      ...notice,
      kind: 'done'
    })
    expect(decorate(notice, entry())).toBe(notice)
    expect(decorate(notice, entry({ state: 'working', interactivePrompt: ask([]) }))).toBe(notice)
  })

  it('builds Allow/Deny for a PTY permission request', () => {
    const decorated = decorate(
      { ...notice, kind: 'blocked' },
      entry({ state: 'blocked', interactivePrompt: JSON.stringify({ approval: { tool: 'Bash' } }) })
    )
    expect(decorated.buttons).toHaveLength(1)
    expect(decorated.buttons[0]!.map((button) => button.label)).toEqual([
      telegramAnswerText.allow(),
      telegramAnswerText.deny()
    ])
    expect(decorated.buttons[0]!.map((b) => decodeTelegramPromptAction(b.action)?.kind)).toEqual([
      'approval',
      'approval'
    ])
    expect(decorated.text).toBe(notice.text)
  })

  it('does not repeat the first question PR1 already prints', () => {
    const decorated = decorate(
      notice,
      entry({
        toolName: 'AskUserQuestion',
        interactivePrompt: ask([
          { question: 'Color?', options: [{ label: 'Red' }, { label: 'Blue' }] }
        ])
      })
    )
    expect(decorated.buttons.map((row) => row.map((b) => b.label))).toEqual([['Red'], ['Blue']])
    expect(decorated.text).not.toContain('Color?')
    expect(decorated.text).toContain(telegramAnswerText.hintReply())
  })

  it('numbers multi-question options, lists later questions, and adds Send', () => {
    const decorated = decorate(
      notice,
      entry({
        interactivePrompt: ask([
          { question: 'A?', options: [{ label: 'a1' }, { label: 'a2' }] },
          { question: 'B?', multiSelect: true, options: [{ label: 'b1' }] }
        ])
      })
    )
    const labels = decorated.buttons.map((row) => row[0]!.label)
    expect(labels).toEqual(['1. a1', '1. a2', '2. b1', telegramAnswerText.submit()])
    expect(decodeTelegramPromptAction(decorated.buttons[2]![0]!.action)).toMatchObject({
      kind: 'option',
      questionIndex: 1,
      optionIndex: 0
    })
    expect(decorated.text).not.toContain('A?')
    expect(decorated.text).toContain('<b>2.</b> B?')
    expect(decorated.text).toContain(telegramAnswerText.hintMultiSelect())
  })

  it('adds Send to a lone multi-select question', () => {
    const decorated = decorate(
      notice,
      entry({
        interactivePrompt: ask([
          { question: 'Pick', multiSelect: true, options: [{ label: 'x' }, { label: 'y' }] }
        ])
      })
    )
    expect(decorated.buttons.at(-1)![0]!.label).toBe(telegramAnswerText.submit())
  })

  it('truncates long labels, escapes HTML, and keeps callback_data within 64 bytes', () => {
    const long = 'Ã'.repeat(120)
    const decorated = decorate(
      notice,
      entry({
        interactivePrompt: ask([
          { question: 'q1', options: Array.from({ length: 20 }, () => ({ label: long })) },
          { question: '<script>&', options: [{ label: long }] },
          { question: 'q3', options: [{ label: long }] },
          { question: 'q4', multiSelect: true, options: [{ label: long }] }
        ])
      })
    )
    expect(decorated.text).toContain('&lt;script&gt;&amp;')
    for (const row of decorated.buttons) {
      for (const button of row) {
        expect(Array.from(button.label).length).toBeLessThanOrEqual(40)
        expect(callbackBytes(button.action)).toBeLessThanOrEqual(64)
      }
    }
  })

  it('keeps the notice under Telegram’s 4096-character limit for huge prompts', () => {
    const huge = 'x'.repeat(5000)
    const longNotice: TelegramNotice = { ...notice, text: 'n'.repeat(3500) }
    const decorated = decorate(
      longNotice,
      entry({
        interactivePrompt: ask([
          { question: huge, options: [{ label: 'a' }] },
          { question: huge, options: [{ label: 'b' }] },
          { question: huge, options: [{ label: 'c' }] },
          { question: huge, options: [{ label: 'd' }] }
        ])
      })
    )
    expect(decorated.text.length).toBeLessThanOrEqual(4096)
    expect(decorated.text.startsWith(longNotice.text)).toBe(true)
  })

  it('skips buttons entirely for more than 4 questions or 20 options', () => {
    const fiveQuestions = Array.from({ length: 5 }, (_, index) => ({
      question: `q${index}`,
      options: [{ label: 'a' }]
    }))
    expect(decorate(notice, entry({ interactivePrompt: ask(fiveQuestions) }))).toBe(notice)
    const manyOptions = [
      { question: 'q', options: Array.from({ length: 21 }, (_, i) => ({ label: `o${i}` })) }
    ]
    expect(decorate(notice, entry({ interactivePrompt: ask(manyOptions) }))).toBe(notice)
  })

  it('builds structured approval buttons from the journal options', () => {
    const sessionId = 'sess-1'
    const tabId = structuredAgentSessionTabId(sessionId)
    const item: AgentJournalRenderItem = {
      itemId: 'item-1',
      revision: 3,
      sequence: 1,
      observedAt: 1,
      body: {
        kind: 'approval',
        title: 'Run tests?',
        detail: null,
        options: [
          { id: 'allow', label: 'Allow once' },
          { id: 'always', label: 'Always allow' },
          { id: 'deny', label: 'Deny' }
        ],
        resolution: { state: 'pending', selectedOptionId: null, resolvedBy: null, resolvedAt: null }
      }
    }
    const structuredDecorate = createTelegramPromptButtonDecorator((id) =>
      id === sessionId ? { fence: 2, items: [item] } : null
    )
    const decorated = structuredDecorate(
      { ...notice, kind: 'blocked' },
      entry({
        state: 'blocked',
        tabId,
        paneKey: structuredAgentSessionPaneKey(tabId, sessionId),
        terminalHandle: undefined
      })
    )
    expect(decorated.buttons.map((row) => row.map((b) => b.label))).toEqual([
      ['Allow once'],
      ['Always allow'],
      ['Deny']
    ])
    // Structured rows carry no interactivePrompt, so PR1 cannot print the request itself.
    expect(decorated.text).toContain('Run tests?')
  })
})

describe('telegram prompt action codec', () => {
  it('round-trips every action kind', () => {
    for (const action of [
      { tag: '0123abcd', kind: 'approval', optionIndex: 1 },
      { tag: '0123abcd', kind: 'option', questionIndex: 3, optionIndex: 19 },
      { tag: '0123abcd', kind: 'submit' }
    ] as const) {
      expect(decodeTelegramPromptAction(encodeTelegramPromptAction(action))).toEqual(action)
    }
  })

  it.each(['', 'zz', '0123abcd.x', '0123abcd.a', '0123abcd.o1', '0123ABCD.s', '0123abcd.a123'])(
    'rejects %s',
    (value) => {
      expect(decodeTelegramPromptAction(value)).toBeNull()
    }
  )
})
