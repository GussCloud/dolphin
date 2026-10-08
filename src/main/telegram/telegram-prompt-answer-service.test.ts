import { describe, expect, it, vi } from 'vitest'
import type { AgentStatusEntry } from '../../shared/agent-status-types'
import type { AgentJournalRenderItem } from '../../shared/agent-session-journal-types'
import {
  structuredAgentSessionPaneKey,
  structuredAgentSessionTabId
} from '../../shared/structured-agent-session-projection'
import { createTelegramPromptButtonDecorator } from './telegram-prompt-buttons'
import {
  TELEGRAM_ANSWER_MESSAGES,
  type TelegramDeliveryOutcome,
  type TelegramStructuredResponse
} from './telegram-prompt-answer-delivery'
import {
  createTelegramPromptAnswerService,
  type TelegramPromptAnswerPorts
} from './telegram-prompt-answer-service'
import type { TelegramPaneRoute, TelegramNotice } from './telegram-inbound'
import type { TelegramStructuredPromptSnapshot } from './telegram-answerable-prompt'

const PANE = 'tab-1:leaf-1'

function entry(overrides: Partial<AgentStatusEntry> = {}): AgentStatusEntry {
  return {
    state: 'waiting',
    prompt: 'go',
    updatedAt: 10,
    stateStartedAt: 5,
    paneKey: PANE,
    terminalHandle: 'term-1',
    agentType: 'claude',
    toolName: 'AskUserQuestion',
    stateHistory: [],
    ...overrides
  }
}

function ask(questions: unknown[]): string {
  return JSON.stringify({ questions })
}

const COLOR = ask([{ question: 'Color?', options: [{ label: 'Red' }, { label: 'Blue' }] }])
const APPROVAL = JSON.stringify({ approval: { tool: 'Bash', summary: 'rm -rf' } })

function harness(initial: AgentStatusEntry | null, structured?: TelegramStructuredPromptSnapshot) {
  let current = initial
  const sent: { terminal: string; text: string; enter: boolean }[] = []
  const responses: TelegramStructuredResponse[] = []
  const messages: { sessionId: string; fence: number; text: string }[] = []
  let outcomes: TelegramDeliveryOutcome[] = []
  const inferQuestionAnswered = vi.fn()
  const readStructuredPrompt = (): TelegramStructuredPromptSnapshot | null => structured ?? null
  const ports: TelegramPromptAnswerPorts = {
    readEntry: (paneKey) => (current?.paneKey === paneKey ? current : null),
    readStructuredPrompt,
    sendTerminal: async (input) => {
      sent.push(input)
      return outcomes.shift() ?? 'accepted'
    },
    respondStructured: async (response) => {
      responses.push(response)
      return outcomes.shift() ?? 'accepted'
    },
    sendStructuredMessage: async (input) => {
      messages.push(input)
      return outcomes.shift() ?? 'accepted'
    },
    inferQuestionAnswered,
    resolveWorktreeQuery: (query) =>
      query === 'wt'
        ? [{ worktreeId: 'wt', paneKeys: [PANE] }]
        : query === 'many'
          ? [{ worktreeId: 'many', paneKeys: [PANE, 'tab-2:leaf'] }]
          : [],
    wait: async () => undefined
  }
  const service = createTelegramPromptAnswerService(ports)
  const decorate = createTelegramPromptButtonDecorator(readStructuredPrompt)
  return {
    service,
    sent,
    responses,
    messages,
    inferQuestionAnswered,
    setEntry: (next: AgentStatusEntry | null) => {
      current = next
    },
    setOutcomes: (next: TelegramDeliveryOutcome[]) => {
      outcomes = next
    },
    /** Actions exactly as the notice decorator rendered them for the current entry. */
    actions: (): string[] => {
      const notice: TelegramNotice = { kind: 'waiting', text: '', buttons: [] }
      return current
        ? decorate(notice, current)
            .buttons.flat()
            .map((b) => b.action)
        : []
    },
    route: (overrides: Partial<TelegramPaneRoute> = {}): TelegramPaneRoute => ({
      routeId: 'r1',
      paneKey: PANE,
      terminalHandle: 'term-1',
      interactivePrompt: current?.interactivePrompt,
      ...overrides
    })
  }
}

function tap(h: ReturnType<typeof harness>, action: string, route = h.route()) {
  return h.service.handleCallback!({ chatId: 1, messageId: 2, callbackQueryId: 'q', route, action })
}

describe('PTY approvals', () => {
  it('sends "1" for Permitir and Escape for Negar without Enter', async () => {
    const h = harness(entry({ state: 'blocked', interactivePrompt: APPROVAL, toolName: 'Bash' }))
    const [allow, deny] = h.actions()
    expect(await tap(h, allow!)).toEqual({ ok: true, ack: TELEGRAM_ANSWER_MESSAGES.sent })
    expect(await tap(h, deny!)).toMatchObject({ ok: true })
    expect(h.sent).toEqual([
      { terminal: 'term-1', text: '1', enter: false },
      { terminal: 'term-1', text: '\x1b', enter: false }
    ])
  })

  it('reports an unconfirmed delivery as such, not as a failure to resend', async () => {
    const h = harness(entry({ state: 'blocked', interactivePrompt: APPROVAL }))
    h.setOutcomes(['unknown'])
    expect(await tap(h, h.actions()[0]!)).toEqual({
      ok: false,
      error: TELEGRAM_ANSWER_MESSAGES.unconfirmed
    })
  })
})

describe('stale prompt detection', () => {
  it('rejects a tap after the pane left waiting', async () => {
    const h = harness(entry({ interactivePrompt: COLOR }))
    const [red] = h.actions()
    const route = h.route()
    h.setEntry(entry({ state: 'working', interactivePrompt: undefined }))
    expect(await tap(h, red!, route)).toEqual({ ok: false, error: TELEGRAM_ANSWER_MESSAGES.stale })
    expect(h.sent).toEqual([])
  })

  it('rejects a tap meant for a previous question on the same pane', async () => {
    const h = harness(entry({ interactivePrompt: COLOR }))
    const [red] = h.actions()
    const route = h.route()
    h.setEntry(
      entry({ interactivePrompt: ask([{ question: 'Size?', options: [{ label: 'S' }] }]) })
    )
    expect(await tap(h, red!, route)).toMatchObject({
      ok: false,
      error: TELEGRAM_ANSWER_MESSAGES.stale
    })
    // Even without the pinned prompt JSON, the action tag catches the swap.
    expect(await tap(h, red!, { ...route, interactivePrompt: undefined })).toMatchObject({
      ok: false
    })
    expect(h.sent).toEqual([])
  })

  it('rejects a pane that no longer exists', async () => {
    const h = harness(entry({ interactivePrompt: COLOR }))
    const [red] = h.actions()
    h.setEntry(null)
    expect(await tap(h, red!)).toMatchObject({ ok: false, error: TELEGRAM_ANSWER_MESSAGES.stale })
  })
})

describe('PTY questions per agent', () => {
  it('drives Claude by option number and infers the answered question', async () => {
    const h = harness(entry({ interactivePrompt: COLOR }))
    expect(await tap(h, h.actions()[1]!)).toMatchObject({ ok: true })
    expect(h.sent).toEqual([{ terminal: 'term-1', text: '2', enter: false }])
    expect(h.inferQuestionAnswered).toHaveBeenCalledWith({
      paneKey: PANE,
      baselineUpdatedAt: 10,
      baselineStateStartedAt: 5,
      baselinePrompt: 'go',
      baselineAgentType: 'claude'
    })
  })

  it('pastes the label with Enter for agents without a digit selector', async () => {
    const h = harness(entry({ agentType: 'grok', interactivePrompt: COLOR }))
    await tap(h, h.actions()[0]!)
    expect(h.sent).toEqual([{ terminal: 'term-1', text: 'Red', enter: true }])
    expect(h.inferQuestionAnswered).not.toHaveBeenCalled()
  })

  it('uses Codex overlay keys for a typed Codex answer', async () => {
    const h = harness(
      entry({ agentType: 'codex', toolName: 'request_user_input', interactivePrompt: COLOR })
    )
    const result = await h.service.handleText!({
      chatId: 1,
      messageId: 3,
      text: 'Green\nish',
      route: h.route()
    })
    expect(result).toMatchObject({ ok: true })
    expect(h.sent.map((send) => send.text)).toEqual(['\x1b[A', '\t', 'Green ish', '\r'])
    expect(h.sent.every((send) => !send.enter)).toBe(true)
  })

  it('collects a multi-question answer and sends it once complete', async () => {
    const h = harness(
      entry({
        interactivePrompt: ask([
          { question: 'A?', options: [{ label: 'a1' }, { label: 'a2' }] },
          { question: 'B?', options: [{ label: 'b1' }, { label: 'b2' }] }
        ])
      })
    )
    const [, a2, , b2] = h.actions()
    expect(await tap(h, a2!)).toEqual({ ok: true, ack: '1. a2\n2. —' })
    expect(h.sent).toEqual([])
    expect(await tap(h, b2!)).toMatchObject({ ok: true, ack: TELEGRAM_ANSWER_MESSAGES.sent })
    expect(h.sent.map((send) => send.text)).toEqual(['2', '2', '\r'])
  })

  it('toggles multi-select options and sends on Enviar', async () => {
    const h = harness(
      entry({
        interactivePrompt: ask([
          {
            question: 'Pick',
            multiSelect: true,
            options: [{ label: 'x' }, { label: 'y' }, { label: 'z' }]
          }
        ])
      })
    )
    const [x, y, z, submit] = h.actions()
    await tap(h, z!)
    await tap(h, x!)
    await tap(h, y!)
    expect(await tap(h, y!)).toEqual({ ok: true, ack: 'x, z' })
    expect(h.sent).toEqual([])
    expect(await tap(h, submit!)).toMatchObject({ ok: true })
    expect(h.sent.map((send) => send.text)).toEqual(['1', '3', '\x1b[C', '\r'])
  })

  it('refuses Enviar with nothing chosen', async () => {
    const h = harness(
      entry({
        interactivePrompt: ask([{ question: 'Pick', multiSelect: true, options: [{ label: 'x' }] }])
      })
    )
    expect(await tap(h, h.actions().at(-1)!)).toEqual({
      ok: false,
      error: TELEGRAM_ANSWER_MESSAGES.incomplete
    })
  })

  it('reports a half-sent selector as partly sent', async () => {
    const h = harness(
      entry({
        interactivePrompt: ask([
          { question: 'A?', options: [{ label: 'a1' }] },
          { question: 'B?', options: [{ label: 'b1' }] }
        ])
      })
    )
    const [a1, b1] = h.actions()
    await tap(h, a1!)
    h.setOutcomes(['accepted', 'rejected'])
    expect(await tap(h, b1!)).toEqual({ ok: false, error: TELEGRAM_ANSWER_MESSAGES.partlySent })
  })

  it('refuses a second answer while one is still being typed into the same terminal', async () => {
    const h = harness(entry({ interactivePrompt: COLOR }))
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const slow = createTelegramPromptAnswerService({
      readEntry: () => entry({ interactivePrompt: COLOR }),
      readStructuredPrompt: () => null,
      sendTerminal: async () => {
        await gate
        return 'accepted'
      },
      respondStructured: async () => 'accepted',
      sendStructuredMessage: async () => 'accepted'
    })
    const [red, blue] = h.actions()
    const route = h.route()
    const first = slow.handleCallback!({
      chatId: 1,
      messageId: 2,
      callbackQueryId: 'a',
      route,
      action: red!
    })
    const second = await slow.handleCallback!({
      chatId: 1,
      messageId: 2,
      callbackQueryId: 'b',
      route,
      action: blue!
    })
    expect(second).toEqual({ ok: false, error: TELEGRAM_ANSWER_MESSAGES.busy })
    release()
    expect(await first).toMatchObject({ ok: true })
  })
})

describe('text replies', () => {
  it('rejects typed text on a permission request', async () => {
    const h = harness(entry({ state: 'blocked', interactivePrompt: APPROVAL }))
    expect(
      await h.service.handleText!({ chatId: 1, messageId: 1, text: 'yes', route: h.route() })
    ).toEqual({
      ok: false,
      error: TELEGRAM_ANSWER_MESSAGES.useButtons
    })
  })

  it('sends plain text plus Enter to an idle PTY pane, on one line', async () => {
    const h = harness(entry({ state: 'done', interactivePrompt: undefined }))
    expect(
      await h.service.handleText!({
        chatId: 1,
        messageId: 1,
        text: 'run\nthe tests ',
        route: h.route()
      })
    ).toMatchObject({ ok: true })
    expect(h.sent).toEqual([{ terminal: 'term-1', text: 'run the tests', enter: true }])
  })

  it('routes /to by worktree and refuses ambiguous or unknown worktrees', async () => {
    const h = harness(entry({ state: 'done' }))
    expect(
      await h.service.handleText!({ chatId: 1, messageId: 1, text: 'hi', worktreeQuery: 'wt' })
    ).toMatchObject({ ok: true })
    expect(h.sent).toEqual([{ terminal: 'term-1', text: 'hi', enter: true }])
    expect(
      await h.service.handleText!({ chatId: 1, messageId: 1, text: 'hi', worktreeQuery: 'many' })
    ).toEqual({
      ok: false,
      error: TELEGRAM_ANSWER_MESSAGES.ambiguousWorktree
    })
    expect(
      await h.service.handleText!({ chatId: 1, messageId: 1, text: 'hi', worktreeQuery: 'nope' })
    ).toEqual({
      ok: false,
      error: TELEGRAM_ANSWER_MESSAGES.noWorktree
    })
  })
})

describe('structured sessions', () => {
  const sessionId = 'sess-1'
  const tabId = structuredAgentSessionTabId(sessionId)
  const structuredEntry = entry({
    tabId,
    paneKey: structuredAgentSessionPaneKey(tabId, sessionId),
    terminalHandle: undefined,
    toolName: undefined
  })
  const pending = {
    state: 'pending' as const,
    selectedOptionId: null,
    resolvedBy: null,
    resolvedAt: null
  }
  const approval: AgentJournalRenderItem = {
    itemId: 'approval-1',
    revision: 4,
    sequence: 1,
    observedAt: 1,
    body: {
      kind: 'approval',
      title: 'Edit file?',
      detail: null,
      options: [
        { id: 'yes', label: 'Yes' },
        { id: 'no', label: 'No' }
      ],
      resolution: pending
    }
  }
  const question: AgentJournalRenderItem = {
    itemId: 'question-1',
    revision: 2,
    sequence: 2,
    observedAt: 2,
    body: {
      kind: 'question',
      question: '',
      options: [],
      questions: [
        { id: 'q-a', question: 'A?', multiSelect: false, options: [{ id: 'a1', label: 'a1' }] },
        {
          id: 'q-b',
          question: 'B?',
          multiSelect: true,
          freeTextQuestionId: 'q-b-free',
          options: [
            { id: 'b1', label: 'b1' },
            { id: 'b2', label: 'b2' }
          ]
        }
      ],
      resolution: pending
    }
  }

  function structuredHarness(items: AgentJournalRenderItem[]) {
    const h = harness(structuredEntry, { fence: 7, items })
    return { ...h, route: () => ({ routeId: 'r9', paneKey: structuredEntry.paneKey }) }
  }

  it('answers an approval through the host with the item revision and fence, never the PTY', async () => {
    const h = structuredHarness([approval])
    expect(await tap(h, h.actions()[1]!, h.route())).toMatchObject({ ok: true })
    expect(h.responses).toEqual([
      {
        sessionId,
        fence: 7,
        kind: 'approval',
        itemId: 'approval-1',
        expectedRevision: 4,
        optionId: 'no'
      }
    ])
    expect(h.sent).toEqual([])
  })

  it('answers grouped questions with host question and option ids', async () => {
    const h = structuredHarness([question])
    const [a1, , b2, submit] = h.actions()
    await tap(h, a1!, h.route())
    await tap(h, b2!, h.route())
    await h.service.handleText!({ chatId: 1, messageId: 1, text: 'extra', route: h.route() })
    expect(await tap(h, submit!, h.route())).toMatchObject({ ok: true })
    expect(h.responses).toEqual([
      {
        sessionId,
        fence: 7,
        kind: 'question',
        itemId: 'question-1',
        expectedRevision: 2,
        answers: [
          { questionId: 'q-a', optionIds: ['a1'] },
          { questionId: 'q-b', optionIds: ['b2'], other: 'extra' }
        ]
      }
    ])
  })

  it('refuses to submit an incomplete structured answer', async () => {
    const h = structuredHarness([question])
    const [a1, , , submit] = h.actions()
    await tap(h, a1!, h.route())
    expect(await tap(h, submit!, h.route())).toEqual({
      ok: false,
      error: TELEGRAM_ANSWER_MESSAGES.incomplete
    })
    expect(h.responses).toEqual([])
  })

  it('treats a resolved structured prompt as stale', async () => {
    const h = structuredHarness([approval])
    const [yes] = h.actions()
    const resolved = harness(structuredEntry, {
      fence: 7,
      items: [
        {
          ...approval,
          revision: 5,
          body: {
            kind: 'approval',
            title: 'Edit file?',
            detail: null,
            options: [{ id: 'yes', label: 'Yes' }],
            resolution: { ...pending, state: 'resolved', selectedOptionId: 'yes' }
          }
        }
      ]
    })
    expect(await tap(resolved, yes!, h.route())).toEqual({
      ok: false,
      error: TELEGRAM_ANSWER_MESSAGES.stale
    })
  })

  it('sends plain text to an idle structured session as a fenced message, keeping line breaks', async () => {
    const h = structuredHarness([])
    expect(
      await h.service.handleText!({ chatId: 1, messageId: 1, text: ' run\nall ', route: h.route() })
    ).toEqual({ ok: true, ack: TELEGRAM_ANSWER_MESSAGES.sent })
    expect(h.messages).toEqual([{ sessionId, fence: 7, text: 'run\nall' }])
    expect(h.sent).toEqual([])
  })

  it('refuses plain text while a structured approval is pending', async () => {
    const h = structuredHarness([approval])
    expect(
      await h.service.handleText!({ chatId: 1, messageId: 1, text: 'hi', route: h.route() })
    ).toEqual({ ok: false, error: TELEGRAM_ANSWER_MESSAGES.useButtons })
    expect(h.messages).toEqual([])
  })

  it('refuses plain text when the session is not readable on this host', async () => {
    const h = harness(structuredEntry)
    expect(
      await h.service.handleText!({
        chatId: 1,
        messageId: 1,
        text: 'hi',
        route: { routeId: 'r9', paneKey: structuredEntry.paneKey }
      })
    ).toEqual({ ok: false, error: TELEGRAM_ANSWER_MESSAGES.structuredUnavailable })
  })

  it('keeps one in-flight send per structured session', async () => {
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const slow = createTelegramPromptAnswerService({
      readEntry: () => structuredEntry,
      readStructuredPrompt: () => ({ fence: 1, items: [] }),
      sendTerminal: async () => 'accepted',
      respondStructured: async () => 'accepted',
      sendStructuredMessage: async () => {
        await gate
        return 'accepted'
      }
    })
    const route = { routeId: 'r9', paneKey: structuredEntry.paneKey }
    const first = slow.handleText!({ chatId: 1, messageId: 1, text: 'a', route })
    expect(await slow.handleText!({ chatId: 1, messageId: 2, text: 'b', route })).toEqual({
      ok: false,
      error: TELEGRAM_ANSWER_MESSAGES.busy
    })
    release()
    expect(await first).toMatchObject({ ok: true })
  })
})
