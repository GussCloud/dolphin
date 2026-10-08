import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConnectPanePtySession } from './connect-pane-pty-session'

const { sendDraft, inspectProcess, channelPty } = vi.hoisted(() => ({
  sendDraft: vi.fn(async () => true),
  inspectProcess: vi.fn(async () => ({ foregroundProcess: 'claude' })),
  channelPty: { value: true }
}))

vi.mock('@/store', () => ({ useAppStore: { getState: () => ({}) } }))
vi.mock('@/lib/worktree-runtime-owner', () => ({ getSettingsForWorktreeRuntimeOwner: () => null }))
vi.mock('@/lib/agent-draft-paste-content', () => ({ sendAgentDraftPasteContent: sendDraft }))
vi.mock('@/runtime/runtime-terminal-inspection', () => ({
  inspectRuntimeTerminalProcess: inspectProcess,
  isRemoteRuntimePtyId: () => false
}))
vi.mock('@/lib/claude-channel-pty', () => ({ isClaudeChannelPtyKnown: () => channelPty.value }))

import { bindSettlePaneSerializer } from './pane-serializer-settle'

const ESC = String.fromCharCode(27)
const BRACKETED_PASTE_ON = `${ESC}[?2004h`
const DIALOG = `${ESC}[3;3HWARNING:${ESC}[1CLoading${ESC}[1Cdevelopment${ESC}[1Cchannels`
const DISMISSED = `${ESC}]0;✳ Claude Code${String.fromCharCode(7)}${ESC}[?1049h`
const HARD_TIMEOUT_MS = 8_000
const QUIET_MS = 1_500

function createSession(): ConnectPanePtySession {
  const transport = { getPtyId: () => 'pty-1' }
  const fake = {
    ownsStartupDraftPaste: true,
    connectionId: null,
    shouldDeliverStartupViaTerminalPaste: false,
    startupDraftPrompt: 'fix the bug',
    startupDraftAgent: 'claude',
    startupDraftAgentConfig: { expectedProcess: 'claude' },
    disposed: false,
    transport,
    pane: { id: 1 },
    deps: { worktreeId: 'wt', paneTransportsRef: { current: new Map([[1, transport]]) } },
    recordTerminalInputForHibernation: vi.fn()
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the startup-draft path reads only the fields above.
  return fake as unknown as ConnectPanePtySession
}

beforeEach(() => {
  vi.useFakeTimers()
  sendDraft.mockClear()
  inspectProcess.mockClear()
  channelPty.value = true
})

afterEach(() => {
  vi.useRealTimers()
})

describe('startup draft paste while Claude shows the development-channels dialog', () => {
  it('cancels the quiet window, re-arms the hard timeout, and pastes once the dialog is gone', async () => {
    const session = createSession()
    bindSettlePaneSerializer(session)
    session.observeStartupDraftPasteReadiness(BRACKETED_PASTE_ON)
    session.observeStartupDraftPasteReadiness(DIALOG)
    await vi.advanceTimersByTimeAsync(HARD_TIMEOUT_MS * 3)
    expect(sendDraft).not.toHaveBeenCalled()
    expect(inspectProcess).not.toHaveBeenCalled()
    session.observeStartupDraftPasteReadiness(DISMISSED)
    await vi.advanceTimersByTimeAsync(QUIET_MS)
    expect(sendDraft).toHaveBeenCalledTimes(1)
  })

  it('gives up holding after five minutes and takes the ordinary blind path', async () => {
    const session = createSession()
    bindSettlePaneSerializer(session)
    session.observeStartupDraftPasteReadiness(BRACKETED_PASTE_ON + DIALOG)
    await vi.advanceTimersByTimeAsync(5 * 60_000 - HARD_TIMEOUT_MS)
    expect(inspectProcess).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2 * HARD_TIMEOUT_MS)
    expect(inspectProcess).toHaveBeenCalled()
  })

  it('never holds a PTY Dolphin did not launch with the channel flag', async () => {
    channelPty.value = false
    const session = createSession()
    bindSettlePaneSerializer(session)
    session.observeStartupDraftPasteReadiness(BRACKETED_PASTE_ON)
    session.observeStartupDraftPasteReadiness(`cat fixture\r\n${DIALOG}`)
    await vi.advanceTimersByTimeAsync(QUIET_MS)
    expect(sendDraft).toHaveBeenCalledTimes(1)
  })
})
