import { describe, expect, it, vi } from 'vitest'
import {
  createTelegramChannelMcpServer,
  TELEGRAM_CHANNEL_INSTRUCTIONS,
  type TelegramChannelHost
} from './telegram-channel-mcp-server'
import type { TelegramChannelInboundEvent } from './telegram-channel-protocol'

type Sent = Record<string, unknown>

function createHarness(hostOverrides: Partial<TelegramChannelHost> = {}) {
  const sent: Sent[] = []
  const pollQueue: (TelegramChannelInboundEvent[] | 'superseded' | Error)[] = []
  const host: TelegramChannelHost = {
    poll: vi.fn(async (signal: AbortSignal) => {
      const next = pollQueue.shift()
      if (next instanceof Error) {
        throw next
      }
      if (next) {
        return next
      }
      // Idle: park until close aborts, like a held long-poll.
      return new Promise<TelegramChannelInboundEvent[]>((resolve) => {
        signal.addEventListener('abort', () => resolve([]), { once: true })
      })
    }),
    reply: vi.fn(async () => {}),
    requestPermission: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {}),
    ...hostOverrides
  }
  const server = createTelegramChannelMcpServer({
    host,
    version: '9.9.9',
    send: (message) => sent.push(message),
    sleep: async () => {}
  })
  const request = async (id: number, method: string, params?: unknown): Promise<Sent> => {
    server.handleMessage({ jsonrpc: '2.0', id, method, params })
    await vi.waitFor(() => expect(sent.some((m) => m.id === id)).toBe(true))
    return sent.find((m) => m.id === id)!
  }
  return { sent, host, server, pollQueue, request }
}

describe('telegram channel MCP server', () => {
  it('declares the channel, permission-relay and tools capabilities with instructions', async () => {
    const { request, server } = createHarness()
    const response = await request(1, 'initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'claude-code', version: '2.1.294' }
    })
    expect(response.result).toEqual({
      protocolVersion: '2025-06-18',
      capabilities: {
        experimental: { 'claude/channel': {}, 'claude/channel/permission': {} },
        tools: {}
      },
      serverInfo: { name: 'dolphin-telegram', version: '9.9.9' },
      instructions: TELEGRAM_CHANNEL_INSTRUCTIONS
    })
    expect(TELEGRAM_CHANNEL_INSTRUCTIONS).toContain('`reply`')
    await server.close()
  })

  it('never negotiates a protocol revision it does not know', async () => {
    const { request, server } = createHarness()
    const response = await request(1, 'initialize', { protocolVersion: '2026-07-28' })
    expect(response.result).toMatchObject({ protocolVersion: '2025-06-18' })
    await server.close()
  })

  it('lists the reply tool and sends replies through the host', async () => {
    const { request, host, server } = createHarness()
    const tools = await request(2, 'tools/list')
    expect(tools.result).toMatchObject({
      tools: [{ name: 'reply', inputSchema: { required: ['text'] } }]
    })
    const call = await request(3, 'tools/call', { name: 'reply', arguments: { text: ' pronto ' } })
    expect(host.reply).toHaveBeenCalledWith('pronto')
    expect(call.result).toEqual({ content: [{ type: 'text', text: 'sent' }] })
    await server.close()
  })

  it('reports reply failures and empty text as tool errors', async () => {
    const { request, server } = createHarness({
      reply: vi.fn(async () => {
        throw new Error('Dolphin answered 502')
      })
    })
    const empty = await request(4, 'tools/call', { name: 'reply', arguments: { text: '  ' } })
    expect(empty.result).toMatchObject({ isError: true })
    const failed = await request(5, 'tools/call', { name: 'reply', arguments: { text: 'oi' } })
    expect(failed.result).toEqual({
      content: [{ type: 'text', text: 'not sent: Dolphin answered 502' }],
      isError: true
    })
    const unknown = await request(6, 'tools/call', { name: 'other', arguments: {} })
    expect(unknown.error).toMatchObject({ code: -32602 })
    const missing = await request(7, 'resources/list')
    expect(missing.error).toMatchObject({ code: -32601 })
    await server.close()
  })

  it('emits polled Telegram text and permission verdicts as channel notifications', async () => {
    const { sent, server, pollQueue } = createHarness()
    pollQueue.push(new Error('ECONNREFUSED'))
    pollQueue.push([
      { kind: 'message', text: 'roda os testes', meta: { chat_id: '42' } },
      { kind: 'permission-verdict', requestId: 'abcde', behavior: 'allow' }
    ])
    server.handleMessage({ jsonrpc: '2.0', method: 'notifications/initialized' })
    await vi.waitFor(() => expect(sent).toHaveLength(2))
    expect(sent).toEqual([
      {
        jsonrpc: '2.0',
        method: 'notifications/claude/channel',
        params: { content: 'roda os testes', meta: { chat_id: '42' } }
      },
      {
        jsonrpc: '2.0',
        method: 'notifications/claude/channel/permission',
        params: { request_id: 'abcde', behavior: 'allow' }
      }
    ])
    await server.close()
  })

  it('stops polling once a newer session owns the pane', async () => {
    const { host, server, pollQueue } = createHarness()
    pollQueue.push('superseded')
    server.handleMessage({ jsonrpc: '2.0', method: 'notifications/initialized' })
    await vi.waitFor(() => expect(host.poll).toHaveBeenCalledTimes(1))
    await server.close()
    expect(host.poll).toHaveBeenCalledTimes(1)
    expect(host.disconnect).toHaveBeenCalledTimes(1)
  })

  it('relays permission requests and ignores malformed ones', async () => {
    const { host, server } = createHarness()
    server.handleMessage({
      jsonrpc: '2.0',
      method: 'notifications/claude/channel/permission_request',
      params: {
        request_id: 'qwert',
        tool_name: 'Bash',
        description: 'List files',
        input_preview: '{"command":"ls"}'
      }
    })
    server.handleMessage({
      jsonrpc: '2.0',
      method: 'notifications/claude/channel/permission_request',
      params: { request_id: 'NOPE1', tool_name: 'Bash' }
    })
    await vi.waitFor(() => expect(host.requestPermission).toHaveBeenCalledTimes(1))
    expect(host.requestPermission).toHaveBeenCalledWith({
      requestId: 'qwert',
      toolName: 'Bash',
      description: 'List files',
      inputPreview: '{"command":"ls"}'
    })
    await server.close()
  })

  it('answers ping', async () => {
    const { request, server } = createHarness()
    expect((await request(9, 'ping')).result).toEqual({})
    await server.close()
  })
})
