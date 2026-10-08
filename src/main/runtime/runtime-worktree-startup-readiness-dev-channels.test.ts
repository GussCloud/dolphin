import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  waitForWorktreeStartupDraft,
  waitForWorktreeStartupFollowup,
  type WorktreeStartupReadinessHost
} from './runtime-worktree-startup-readiness'

const ESC = String.fromCharCode(27)
const BRACKETED_PASTE_ON = `${ESC}[?2004h`
const DIALOG =
  `${ESC}[3;3HWARNING:${ESC}[1CLoading${ESC}[1Cdevelopment${ESC}[1Cchannels` +
  `${ESC}[9;3HEnter${ESC}[1Cto${ESC}[1Cconfirm`
const DISMISSED = `${ESC}]0;✳ Claude Code${String.fromCharCode(7)}${ESC}[?1049h`
const DRAFT_TIMEOUT_MS = 8_000

function createHost(channelPty: boolean) {
  let listener: ((data: string) => void) | null = null
  let recent = ''
  const host: WorktreeStartupReadinessHost = {
    getPtyId: () => 'pty-1',
    getForegroundProcess: async () => 'claude',
    subscribeToData: (_ptyId, next) => {
      listener = next
      return () => {
        listener = null
      }
    },
    readRecentOutput: () => recent,
    write: vi.fn(),
    isClaudeChannelPty: () => channelPty
  }
  const emit = (data: string): void => {
    recent += data
    listener?.(data)
  }
  return { host, emit }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('worktree startup draft under the development-channels dialog', () => {
  it('holds past the hard timeout and resolves after the dialog is confirmed', async () => {
    const { host, emit } = createHost(true)
    let ptyId: string | null | undefined
    void waitForWorktreeStartupDraft(host, 'h', 'claude').then((value) => (ptyId = value))
    emit(BRACKETED_PASTE_ON)
    emit(DIALOG)
    await vi.advanceTimersByTimeAsync(DRAFT_TIMEOUT_MS * 4)
    expect(ptyId).toBeUndefined()
    emit(DISMISSED)
    await vi.advanceTimersByTimeAsync(1_500)
    expect(ptyId).toBe('pty-1')
  })

  it('stops holding after five minutes', async () => {
    const { host, emit } = createHost(true)
    let ptyId: string | null | undefined
    void waitForWorktreeStartupDraft(host, 'h', 'claude').then((value) => (ptyId = value))
    emit(BRACKETED_PASTE_ON + DIALOG)
    await vi.advanceTimersByTimeAsync(5 * 60_000 + DRAFT_TIMEOUT_MS)
    expect(ptyId).toBeNull()
  })

  it('ignores the phrase in a PTY Dolphin did not launch with the channel flag', async () => {
    const { host, emit } = createHost(false)
    let ptyId: string | null | undefined
    void waitForWorktreeStartupDraft(host, 'h', 'claude').then((value) => (ptyId = value))
    emit(BRACKETED_PASTE_ON)
    emit(DIALOG)
    await vi.advanceTimersByTimeAsync(1_500)
    expect(ptyId).toBe('pty-1')
  })
})

describe('worktree startup follow-up under the development-channels dialog', () => {
  it('waits for confirmation in a channel PTY', async () => {
    const { host, emit } = createHost(true)
    emit(DIALOG)
    let ptyId: string | null | undefined
    void waitForWorktreeStartupFollowup(host, 'h', 'claude').then((value) => (ptyId = value))
    await vi.advanceTimersByTimeAsync(10_000)
    expect(ptyId).toBeUndefined()
    emit(DISMISSED)
    await vi.advanceTimersByTimeAsync(500)
    expect(ptyId).toBe('pty-1')
  })

  it('logs and drops the follow-up when the dialog outlives the cap', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { host, emit } = createHost(true)
    emit(DIALOG)
    let ptyId: string | null | undefined
    void waitForWorktreeStartupFollowup(host, 'h', 'claude').then((value) => (ptyId = value))
    await vi.advanceTimersByTimeAsync(5 * 60_000 + 1_000)
    expect(ptyId).toBeNull()
    expect(warn).toHaveBeenCalledWith(
      '[worktree-create] startup follow-up not sent: Claude channel confirmation still open'
    )
  })

  it('does not wait in a PTY without the channel flag', async () => {
    const { host, emit } = createHost(false)
    emit(DIALOG)
    await expect(waitForWorktreeStartupFollowup(host, 'h', 'claude')).resolves.toBe('pty-1')
  })
})
