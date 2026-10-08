import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/runtime/runtime-terminal-inspection', () => ({
  isRemoteRuntimePtyId: (ptyId: string) => ptyId.startsWith('remote:')
}))

import { isClaudeChannelPtyKnown } from './claude-channel-pty'

function stubQuery(query: ((ptyId: string) => Promise<boolean>) | undefined): void {
  vi.stubGlobal('window', { api: { telegram: query ? { isClaudeChannelPty: query } : undefined } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('isClaudeChannelPtyKnown', () => {
  it('is unknown until main answers, then caches the answer', async () => {
    let answer: (value: boolean) => void = () => {}
    const query = vi.fn(() => new Promise<boolean>((resolve) => (answer = resolve)))
    stubQuery(query)
    expect(isClaudeChannelPtyKnown('pty-a')).toBe('unknown')
    expect(isClaudeChannelPtyKnown('pty-a')).toBe('unknown')
    answer(true)
    await vi.waitFor(() => expect(isClaudeChannelPtyKnown('pty-a')).toBe(true))
    expect(query).toHaveBeenCalledTimes(1)
  })

  it('treats a failed query as false', async () => {
    stubQuery(() => Promise.reject(new Error('ipc gone')))
    expect(isClaudeChannelPtyKnown('pty-b')).toBe('unknown')
    await vi.waitFor(() => expect(isClaudeChannelPtyKnown('pty-b')).toBe(false))
  })

  it('is false without the bridge, for remote PTYs, and without a PTY', () => {
    stubQuery(undefined)
    expect(isClaudeChannelPtyKnown('pty-c')).toBe(false)
    stubQuery(async () => true)
    expect(isClaudeChannelPtyKnown('remote:pty-d')).toBe(false)
    expect(isClaudeChannelPtyKnown(null)).toBe(false)
  })
})
