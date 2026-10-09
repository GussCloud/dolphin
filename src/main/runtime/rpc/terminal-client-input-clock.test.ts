import { describe, expect, it, vi } from 'vitest'
import type { DolphinRuntimeService } from '../dolphin-runtime'
import { readClientTerminalInputAt } from '../../terminal-client-input-clock'
import { RpcDispatcher } from './dispatcher'
import { TERMINAL_METHODS } from './methods/terminal'
import { sendTerminalStreamInput } from './methods/terminal/terminal-input-delivery'

function stubRuntime(ptyId: string): DolphinRuntimeService {
  const runtime: Partial<DolphinRuntimeService> = {
    getRuntimeId: () => 'test-runtime',
    resolveLiveLeafForHandle: vi.fn().mockReturnValue({ ptyId }),
    getDriver: vi.fn().mockReturnValue({ kind: 'idle' }),
    beginMobileInputFloor: vi.fn().mockReturnValue(null),
    sendTerminal: vi
      .fn()
      .mockResolvedValue({ handle: 'terminal-1', accepted: true, bytesWritten: 1 })
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: these paths call only the stubbed members above.
  return runtime as DolphinRuntimeService
}

async function send(ptyId: string, client?: { id: string; type: 'mobile' | 'desktop' }) {
  return new RpcDispatcher({ runtime: stubRuntime(ptyId), methods: TERMINAL_METHODS }).dispatch({
    id: 'req-1',
    authToken: 'tok',
    method: 'terminal.send',
    params: { terminal: 'terminal-1', text: 'hi', enter: false, ...(client ? { client } : {}) }
  })
}

describe('client terminal input clock', () => {
  it('stamps a paired client terminal.send as user input', async () => {
    await expect(send('pty-client', { id: 'phone-1', type: 'mobile' })).resolves.toMatchObject({
      ok: true
    })
    expect(readClientTerminalInputAt('pty-client')).toEqual(expect.any(Number))
  })

  it('does not stamp a clientless in-process send (auto-retry, Telegram)', async () => {
    await send('pty-in-process')
    expect(readClientTerminalInputAt('pty-in-process')).toBeUndefined()
  })

  it('stamps stream input but not an automatic terminal query reply', async () => {
    await sendTerminalStreamInput(stubRuntime('pty-stream-reply'), {
      terminal: 'terminal-1',
      text: '\x1b[1;1R',
      client: { id: 'phone-1', type: 'mobile' },
      isMobile: false
    })
    expect(readClientTerminalInputAt('pty-stream-reply')).toBeUndefined()

    await sendTerminalStreamInput(stubRuntime('pty-stream'), {
      terminal: 'terminal-1',
      text: 'c',
      client: { id: 'phone-1', type: 'mobile' },
      isMobile: false
    })
    expect(readClientTerminalInputAt('pty-stream')).toEqual(expect.any(Number))
  })
})
