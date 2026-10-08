import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentStatusEntry } from '../../shared/agent-status-types'
import { encodeTelegramPromptAction } from './telegram-answerable-prompt'
import { createChannelApprovalButtonStripper } from './telegram-channel-approval-fallback'
import type { TelegramNotice } from './telegram-inbound'

const PANE = 'tab-1:leaf-1'
const approval = JSON.stringify({ approval: { tool: 'Bash' } })
const question = JSON.stringify({
  questions: [{ question: 'Qual?', options: [{ label: 'A' }, { label: 'B' }] }]
})
const approvalButton = {
  label: 'Permitir',
  action: encodeTelegramPromptAction({ tag: 'abcd1234', kind: 'approval', optionIndex: 0 })
}
const otherButton = { label: 'Abrir', action: 'open' }
const notice: TelegramNotice = {
  kind: 'blocked',
  text: 'wt bloqueado',
  buttons: [[approvalButton], [otherButton]]
}

function entry(overrides: Partial<AgentStatusEntry> = {}): AgentStatusEntry {
  return {
    state: 'blocked',
    prompt: 'do it',
    updatedAt: 1,
    stateStartedAt: 1,
    paneKey: PANE,
    terminalHandle: 'term-1',
    agentType: 'claude',
    interactivePrompt: approval,
    stateHistory: [],
    ...overrides
  }
}

function setup(overrides: { connected?: boolean; relayAt?: number | null } = {}) {
  let now = 100_000
  let status: { state: string; interactivePrompt?: string } | null = {
    state: 'blocked',
    interactivePrompt: approval
  }
  const deps = {
    gateway: {
      isConnected: () => overrides.connected ?? true,
      lastPermissionRelayAt: vi.fn(() => overrides.relayAt ?? null)
    },
    bridge: {
      sendToAllowedChats: vi.fn(async () => {}),
      createRoute: (paneKey: string) => ({ routeId: 'fresh1', paneKey })
    },
    readPaneStatus: () => status,
    now: () => now
  }
  return {
    deps,
    strip: createChannelApprovalButtonStripper(deps),
    setStatus: (next: typeof status) => (status = next),
    advanceClock: (ms: number) => (now += ms)
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createChannelApprovalButtonStripper', () => {
  it('keeps the approval notice but strips its approval buttons while the channel relays it', () => {
    const { strip } = setup()
    const stripped = strip(notice, entry())
    expect(stripped.buttons).toEqual([[otherButton]])
    expect(stripped.text).toContain('wt bloqueado')
    expect(stripped.text).toContain('Answer this permission in the Claude channel message.')
  })

  it('leaves questions, waiting notices, unparsed prompts and disconnected panes alone', () => {
    const { strip } = setup()
    expect(strip(notice, entry({ interactivePrompt: question }))).toBe(notice)
    const waiting = { ...notice, kind: 'waiting' as const }
    expect(strip(waiting, entry({ state: 'waiting' }))).toBe(waiting)
    expect(strip(notice, entry({ interactivePrompt: undefined }))).toBe(notice)
    expect(setup({ connected: false }).strip(notice, entry())).toBe(notice)
  })

  it('sends the approval buttons again when no relay arrived within 15s', async () => {
    const { strip, deps } = setup()
    strip(notice, entry())
    await vi.advanceTimersByTimeAsync(14_999)
    expect(deps.bridge.sendToAllowedChats).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(deps.bridge.sendToAllowedChats).toHaveBeenCalledWith(
      'The Claude channel did not relay this permission request. Answer it here:',
      { replyToRoute: { routeId: 'fresh1', paneKey: PANE }, buttons: [[approvalButton]] }
    )
  })

  it('stays quiet when the relay arrived, or the prompt was answered or changed', async () => {
    const relayed = setup({ relayAt: 95_000 })
    relayed.strip(notice, entry())
    await vi.advanceTimersByTimeAsync(15_000)
    expect(relayed.deps.bridge.sendToAllowedChats).not.toHaveBeenCalled()

    for (const next of [{ state: 'working' }, { state: 'blocked', interactivePrompt: question }]) {
      const answered = setup()
      answered.strip(notice, entry())
      answered.setStatus(next)
      await vi.advanceTimersByTimeAsync(15_000)
      expect(answered.deps.bridge.sendToAllowedChats).not.toHaveBeenCalled()
    }
  })
})
