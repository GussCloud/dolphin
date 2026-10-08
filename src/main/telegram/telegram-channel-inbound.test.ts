import { describe, expect, it, vi } from 'vitest'
import type { AgentStatusEntry } from '../../shared/agent-status-types'
import { encodeTelegramPromptAction } from './telegram-answerable-prompt'
import {
  chainTelegramChannelInbound,
  createChannelApprovalButtonStripper
} from './telegram-channel-inbound'
import type { TelegramNotice } from './telegram-inbound'

function entry(overrides: Partial<AgentStatusEntry> = {}): AgentStatusEntry {
  return {
    state: 'blocked',
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

const blocked: TelegramNotice = { kind: 'blocked', text: 'wt bloqueado', buttons: [] }
const approval = JSON.stringify({ approval: { tool: 'Bash' } })
const question = JSON.stringify({
  questions: [{ question: 'Qual?', options: [{ label: 'A' }, { label: 'B' }] }]
})
const route = { routeId: 'abc123', paneKey: 'tab-1:leaf-1' }

describe('chainTelegramChannelInbound', () => {
  it('lets the channel answer first and falls back when it declines', async () => {
    const gateway = {
      tryHandleText: vi.fn(async (event: { text: string }) =>
        event.text === 'channel' ? { ok: true as const, ack: 'Sent to Claude.' } : null
      ),
      tryHandleCallback: vi.fn(async () => null),
      isConnected: () => true
    }
    const fallback = {
      handleText: vi.fn(async () => ({ ok: true as const, ack: 'resposta enviada' })),
      handleCallback: vi.fn(async () => ({ ok: false as const, error: 'pergunta já respondida' }))
    }
    const handler = chainTelegramChannelInbound(gateway, fallback)
    await expect(
      handler.handleText!({ chatId: 1, messageId: 2, text: 'channel' })
    ).resolves.toEqual({ ok: true, ack: 'Sent to Claude.' })
    expect(fallback.handleText).not.toHaveBeenCalled()
    await expect(
      handler.handleText!({ chatId: 1, messageId: 2, text: 'terminal' })
    ).resolves.toEqual({ ok: true, ack: 'resposta enviada' })
    await expect(
      handler.handleCallback!({ chatId: 1, messageId: 2, callbackQueryId: 'q', route, action: 'x' })
    ).resolves.toEqual({ ok: false, error: 'pergunta já respondida' })
  })
})

describe('createChannelApprovalButtonStripper', () => {
  const approvalButton = {
    label: 'Permitir',
    action: encodeTelegramPromptAction({ tag: 'abcd1234', kind: 'approval', optionIndex: 0 })
  }
  const otherButton = { label: 'Abrir', action: 'open' }
  const withButtons: TelegramNotice = { ...blocked, buttons: [[approvalButton], [otherButton]] }

  it('keeps the approval notice but strips its approval buttons while the channel relays it', () => {
    let connected = true
    const strip = createChannelApprovalButtonStripper({ isConnected: () => connected })
    const stripped = strip(withButtons, entry({ interactivePrompt: approval }))
    expect(stripped.buttons).toEqual([[otherButton]])
    expect(stripped.text).toContain(blocked.text)
    expect(stripped.text).toContain('Answer this permission in the Claude channel message.')
    connected = false
    expect(strip(withButtons, entry({ interactivePrompt: approval }))).toBe(withButtons)
  })

  it('leaves questions, waiting notices and unparsed prompts alone', () => {
    const strip = createChannelApprovalButtonStripper({ isConnected: () => true })
    expect(strip(withButtons, entry({ interactivePrompt: question }))).toBe(withButtons)
    const waiting = { ...withButtons, kind: 'waiting' as const }
    expect(strip(waiting, entry({ state: 'waiting', interactivePrompt: approval }))).toBe(waiting)
    expect(strip(withButtons, entry())).toBe(withButtons)
  })
})
