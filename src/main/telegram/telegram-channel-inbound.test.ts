import { describe, expect, it, vi } from 'vitest'
import type { AgentStatusEntry } from '../../shared/agent-status-types'
import {
  chainTelegramChannelInbound,
  createChannelPermissionNoticeFilter
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
        event.text === 'channel' ? { ok: true as const, ack: 'Enviado ao Claude.' } : null
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
    ).resolves.toEqual({ ok: true, ack: 'Enviado ao Claude.' })
    expect(fallback.handleText).not.toHaveBeenCalled()
    await expect(
      handler.handleText!({ chatId: 1, messageId: 2, text: 'terminal' })
    ).resolves.toEqual({ ok: true, ack: 'resposta enviada' })
    await expect(
      handler.handleCallback!({ chatId: 1, messageId: 2, callbackQueryId: 'q', route, action: 'x' })
    ).resolves.toEqual({ ok: false, error: 'pergunta já respondida' })
  })
})

describe('createChannelPermissionNoticeFilter', () => {
  it('drops hook approval notices only while the pane has a connected channel', () => {
    let connected = true
    const keep = createChannelPermissionNoticeFilter({ isConnected: () => connected })
    expect(keep(blocked, entry({ interactivePrompt: approval }))).toBe(false)
    expect(keep(blocked, entry({ interactivePrompt: question }))).toBe(true)
    expect(
      keep(
        { ...blocked, kind: 'waiting' },
        entry({ state: 'waiting', interactivePrompt: question })
      )
    ).toBe(true)
    expect(keep(blocked, entry())).toBe(true)
    connected = false
    expect(keep(blocked, entry({ interactivePrompt: approval }))).toBe(true)
  })
})
