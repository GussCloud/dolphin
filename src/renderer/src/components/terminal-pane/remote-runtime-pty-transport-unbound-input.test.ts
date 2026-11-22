import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  TerminalStreamOpcode,
  decodeTerminalStreamFrame,
  decodeTerminalStreamText
} from '../../../../shared/terminal-stream-protocol'
import {
  createRemoteRuntimeTransportMocks,
  type MultiplexSubscriptionCallbacks
} from './remote-runtime-pty-transport-test-harness'

let subscriptionCallbacks: MultiplexSubscriptionCallbacks = null
let resolvedPaneHandle = 'terminal-1'

const { runtimeCall, subscriptionSendBinary, resetRemoteRuntimeTransport } =
  createRemoteRuntimeTransportMocks({
    getCallbacks: () => subscriptionCallbacks,
    setCallbacks: (callbacks) => {
      subscriptionCallbacks = callbacks
    },
    getResolvedPaneHandle: () => resolvedPaneHandle,
    setResolvedPaneHandle: (handle) => {
      resolvedPaneHandle = handle
    }
  })

function sentInputText(): string {
  return subscriptionSendBinary.mock.calls
    .map((call) => decodeTerminalStreamFrame(call[0]))
    .filter((frame) => frame?.opcode === TerminalStreamOpcode.Input)
    .map((frame) => (frame ? decodeTerminalStreamText(frame.payload) : ''))
    .join('')
}

describe('remote runtime transport input typed before the first attach', () => {
  beforeEach(() => {
    resetRemoteRuntimeTransport()
  })

  // A revealed parked pane paints its cached snapshot before the remount's transport attaches,
  // so a user can type into it before any handle exists.
  it('delivers keystrokes typed before attach once the stream is live', async () => {
    const { createRemoteRuntimePtyTransport } = await import('./remote-runtime-pty-transport')
    const transport = createRemoteRuntimePtyTransport('env-1', {
      worktreeId: 'wt-1',
      tabId: 'tab-1',
      leafId: 'pane:1'
    })

    expect(transport.sendInput('probe')).toBe(true)
    expect(transport.sendInput('\r')).toBe(true)

    transport.attach({ existingPtyId: 'remote:terminal-1', cols: 80, rows: 24, callbacks: {} })

    await vi.waitFor(() => expect(sentInputText()).toBe('probe\r'))
    expect(transport.sendInput('next')).toBe(true)
    await vi.waitFor(() => expect(sentInputText()).toBe('probe\rnext'))
    expect(runtimeCall).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: 'terminal.send' })
    )
    transport.destroy?.()
  })

  it('drops held keystrokes when the pane is detached before it attaches', async () => {
    const { createRemoteRuntimePtyTransport } = await import('./remote-runtime-pty-transport')
    const transport = createRemoteRuntimePtyTransport('env-1', {
      worktreeId: 'wt-1',
      tabId: 'tab-1',
      leafId: 'pane:1'
    })

    expect(transport.sendInput('stale')).toBe(true)
    transport.detach?.()
    transport.attach({ existingPtyId: 'remote:terminal-1', cols: 80, rows: 24, callbacks: {} })

    await vi.waitFor(() =>
      expect(
        subscriptionSendBinary.mock.calls.some(
          (call) => decodeTerminalStreamFrame(call[0])?.opcode === TerminalStreamOpcode.Subscribe
        )
      ).toBe(true)
    )
    expect(transport.sendInput('fresh')).toBe(true)
    await vi.waitFor(() => expect(sentInputText()).toBe('fresh'))
    transport.destroy?.()
  })
})
