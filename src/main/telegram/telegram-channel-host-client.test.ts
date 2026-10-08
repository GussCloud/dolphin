import { describe, expect, it, vi } from 'vitest'
import {
  createTelegramChannelHttpHost,
  resolveTelegramChannelEndpoint
} from './telegram-channel-host-client'

describe('resolveTelegramChannelEndpoint', () => {
  it('prefers the endpoint file, which follows a Dolphin restart', () => {
    const env = {
      DOLPHIN_AGENT_HOOK_ENDPOINT: 'endpoint.cmd',
      DOLPHIN_AGENT_HOOK_PORT: '1111',
      DOLPHIN_AGENT_HOOK_TOKEN: 'old'
    }
    const file = 'set DOLPHIN_AGENT_HOOK_PORT=2222\r\nset DOLPHIN_AGENT_HOOK_TOKEN=new\r\n'
    expect(resolveTelegramChannelEndpoint(env, () => file)).toEqual({ port: 2222, token: 'new' })
    expect(
      resolveTelegramChannelEndpoint(
        env,
        () => 'DOLPHIN_AGENT_HOOK_PORT=3333\nDOLPHIN_AGENT_HOOK_TOKEN=t\n'
      )
    ).toEqual({ port: 3333, token: 't' })
  })

  it('falls back to the PTY env and rejects incomplete coordinates', () => {
    const unreadable = (): string => {
      throw new Error('ENOENT')
    }
    expect(
      resolveTelegramChannelEndpoint(
        {
          DOLPHIN_AGENT_HOOK_ENDPOINT: 'x',
          DOLPHIN_AGENT_HOOK_PORT: '1111',
          DOLPHIN_AGENT_HOOK_TOKEN: 'a'
        },
        unreadable
      )
    ).toEqual({ port: 1111, token: 'a' })
    expect(resolveTelegramChannelEndpoint({ DOLPHIN_AGENT_HOOK_PORT: '1111' })).toBeNull()
    expect(
      resolveTelegramChannelEndpoint({
        DOLPHIN_AGENT_HOOK_PORT: 'abc',
        DOLPHIN_AGENT_HOOK_TOKEN: 't'
      })
    ).toBeNull()
  })
})

describe('createTelegramChannelHttpHost', () => {
  const session = { paneKey: 'tab:leaf', sessionId: 's1' }
  const endpoint = { port: 1, token: 't' }

  it('stamps every post with the session and maps 409 to superseded', async () => {
    const postJson = vi.fn(async () => ({ status: 409, body: null }))
    const host = createTelegramChannelHttpHost({
      session,
      resolveEndpoint: () => endpoint,
      postJson
    })
    await expect(host.poll(new AbortController().signal)).resolves.toBe('superseded')
    expect(postJson).toHaveBeenCalledWith(endpoint, '/channel/poll', session, expect.anything())
  })

  it('parses polled events and drops malformed ones', async () => {
    const postJson = vi.fn(async () => ({
      status: 200,
      body: {
        events: [
          { kind: 'message', text: 'oi', meta: { chat_id: '1', 'bad-key': 'x', n: 2 } },
          { kind: 'permission-verdict', requestId: 'abcde', behavior: 'allow' },
          { kind: 'permission-verdict', requestId: 'ABCDE', behavior: 'allow' },
          { kind: 'other' }
        ]
      }
    }))
    const host = createTelegramChannelHttpHost({
      session,
      resolveEndpoint: () => endpoint,
      postJson
    })
    await expect(host.poll(new AbortController().signal)).resolves.toEqual([
      { kind: 'message', text: 'oi', meta: { chat_id: '1' } },
      { kind: 'permission-verdict', requestId: 'abcde', behavior: 'allow' }
    ])
  })

  it('fails replies when Dolphin is unreachable or refuses', async () => {
    const unreachable = createTelegramChannelHttpHost({ session, resolveEndpoint: () => null })
    await expect(unreachable.reply('x')).rejects.toThrow('not reachable')
    const refused = createTelegramChannelHttpHost({
      session,
      resolveEndpoint: () => endpoint,
      postJson: async () => ({ status: 502, body: null })
    })
    await expect(refused.reply('x')).rejects.toThrow('502')
  })
})
