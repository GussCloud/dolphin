import { describe, expect, it } from 'vitest'
import { createTelegramChannelMcpServer } from '../telegram/telegram-channel-mcp-server'
import { OrchestrationChannelGateway } from './orchestration-channel-gateway'
import {
  ORCHESTRATION_CHANNEL_DISCONNECT_PATH,
  ORCHESTRATION_CHANNEL_POLL_PATH,
  ORCHESTRATION_CHANNEL_PROFILE
} from './orchestration-channel-protocol'

const REF = { paneKey: 'tab:leaf', sessionId: 'session-1' }

function connect(gateway: OrchestrationChannelGateway) {
  const sent: Record<string, unknown>[] = []
  const server = createTelegramChannelMcpServer({
    version: 'test',
    profile: ORCHESTRATION_CHANNEL_PROFILE,
    send: (message) => sent.push(message),
    host: {
      async poll(signal, ack) {
        const result = await gateway.handleRoute({
          pathname: ORCHESTRATION_CHANNEL_POLL_PATH,
          body: { ...REF, ack },
          signal
        })
        if (result.status === 204) {
          return []
        }
        const json = result.json
        return json && typeof json === 'object' && 'events' in json && Array.isArray(json.events)
          ? json.events
          : []
      },
      reply: async () => {},
      requestPermission: async () => {},
      async disconnect() {
        await gateway.handleRoute({
          pathname: ORCHESTRATION_CHANNEL_DISCONNECT_PATH,
          body: REF,
          signal: new AbortController().signal
        })
      }
    }
  })
  return { server, sent }
}

describe('orchestration channel', () => {
  it('declares a push-only channel: no reply tool, no permission relay', () => {
    const { server, sent } = connect(new OrchestrationChannelGateway({ pollHoldMs: 10 }))
    server.handleMessage({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })
    server.handleMessage({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
    expect(sent[0]).toMatchObject({
      result: {
        capabilities: { experimental: { 'claude/channel': {} } },
        serverInfo: { name: 'dolphin-orchestration' }
      }
    })
    expect(JSON.stringify(sent[0])).not.toContain('claude/channel/permission')
    expect(sent[1]).toMatchObject({ result: { tools: [] } })
  })

  it('emits a pushed pointer as a channel notification and acknowledges it', async () => {
    const gateway = new OrchestrationChannelGateway({ pollHoldMs: 5_000 })
    const { server, sent } = connect(gateway)
    expect(gateway.connectedSessionId(REF.paneKey)).toBeNull()
    server.handleMessage({ jsonrpc: '2.0', method: 'notifications/initialized' })
    await expect.poll(() => gateway.connectedSessionId(REF.paneKey)).toBe('session-1')
    const delivery = gateway.push(REF.paneKey, 'You have 1 orchestration message.')
    await expect.poll(() => sent.length).toBe(1)
    expect(sent[0]).toEqual({
      jsonrpc: '2.0',
      method: 'notifications/claude/channel',
      params: { content: 'You have 1 orchestration message.', meta: {} }
    })
    await expect(delivery).resolves.toBe('delivered')
    await server.close()
    expect(gateway.connectedSessionId(REF.paneKey)).toBeNull()
  })

  it('reports not-connected when no server polls the pane', async () => {
    await expect(new OrchestrationChannelGateway().push('tab:other', 'x')).resolves.toBe(
      'not-connected'
    )
  })
})
