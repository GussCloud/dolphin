import { afterEach, describe, expect, it, vi } from 'vitest'
import { AgentHookServer, _internals } from '../agent-hooks/server'
import { TelegramChannelGateway } from './telegram-channel-gateway'
import {
  createTelegramChannelHttpHost,
  resolveTelegramChannelEndpoint
} from './telegram-channel-host-client'
import { createTelegramChannelMcpServer } from './telegram-channel-mcp-server'

vi.mock('../telemetry/client', () => ({ track: vi.fn() }))
vi.mock('../telemetry/cohort-classifier', () => ({ getCohortAtEmit: vi.fn(() => ({})) }))

const PANE = 'tab-1:leaf-1'
const servers: AgentHookServer[] = []

async function startHookServer(): Promise<AgentHookServer> {
  _internals.resetCachesForTests()
  const server = new AgentHookServer()
  await server.start({ env: 'production' })
  servers.push(server)
  return server
}

afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.setChannelRouteHandler(null)
    await server.stop()
  }
})

describe('telegram channel over the agent-hook listener', () => {
  it('rejects channel posts without the hook token and 404s when no gateway is registered', async () => {
    const server = await startHookServer()
    const env = server.buildPtyEnv()
    const url = `http://127.0.0.1:${env.DOLPHIN_AGENT_HOOK_PORT}/channel/poll`
    const body = JSON.stringify({ paneKey: PANE, sessionId: 's' })
    const headers = { 'Content-Type': 'application/json' }
    expect((await fetch(url, { method: 'POST', headers, body })).status).toBe(403)
    const authed = { ...headers, 'X-Dolphin-Agent-Hook-Token': env.DOLPHIN_AGENT_HOOK_TOKEN }
    expect((await fetch(url, { method: 'POST', headers: authed, body })).status).toBe(404)
  })

  it('holds a long-poll past the 5s slowloris cap of the listener', async () => {
    const server = await startHookServer()
    const gateway = new TelegramChannelGateway(
      { sendToAllowedChats: vi.fn(), createRoute: vi.fn(), resolveWorktreeQuery: () => [] },
      { pollHoldMs: 7_000 }
    )
    server.setChannelRouteHandler(gateway.handleRoute)
    const host = createTelegramChannelHttpHost({
      session: { paneKey: PANE, sessionId: 'long' },
      resolveEndpoint: () => resolveTelegramChannelEndpoint(server.buildPtyEnv())
    })
    const polled = host.poll(new AbortController().signal)
    await new Promise((resolve) => setTimeout(resolve, 6_000))
    expect(gateway.deliver(PANE, 'late')).toBe(true)
    await expect(polled).resolves.toEqual([{ kind: 'message', text: 'late', meta: {} }])
  }, 15_000)

  it('carries Telegram text in, Claude replies out, and a permission verdict back', async () => {
    const server = await startHookServer()
    const bridge = {
      sendToAllowedChats: vi.fn(async () => {}),
      createRoute: (paneKey: string) => ({ routeId: 'abc123', paneKey }),
      resolveWorktreeQuery: () => []
    }
    const gateway = new TelegramChannelGateway(bridge, { pollHoldMs: 300 })
    server.setChannelRouteHandler(gateway.handleRoute)
    const host = createTelegramChannelHttpHost({
      session: { paneKey: PANE, sessionId: 'session-1' },
      resolveEndpoint: () => resolveTelegramChannelEndpoint(server.buildPtyEnv())
    })
    const sent: Record<string, unknown>[] = []
    const mcp = createTelegramChannelMcpServer({
      host,
      version: 'test',
      send: (message) => sent.push(message)
    })
    mcp.handleMessage({ jsonrpc: '2.0', method: 'notifications/initialized' })
    await vi.waitFor(() => expect(gateway.isConnected(PANE)).toBe(true))

    await expect(
      gateway.tryHandleText({ chatId: 1, messageId: 2, text: 'status do build?' })
    ).resolves.toEqual({ ok: true, ack: 'Enviado ao Claude.' })
    await vi.waitFor(() =>
      expect(sent).toContainEqual({
        jsonrpc: '2.0',
        method: 'notifications/claude/channel',
        params: { content: 'status do build?', meta: { chat_id: '1', message_id: '2' } }
      })
    )

    mcp.handleMessage({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'reply', arguments: { text: 'build verde' } }
    })
    await vi.waitFor(() =>
      expect(sent).toContainEqual({
        jsonrpc: '2.0',
        id: 5,
        result: { content: [{ type: 'text', text: 'sent' }] }
      })
    )
    expect(bridge.sendToAllowedChats).toHaveBeenCalledWith('build verde', {
      replyToRoute: { routeId: 'abc123', paneKey: PANE }
    })

    mcp.handleMessage({
      jsonrpc: '2.0',
      method: 'notifications/claude/channel/permission_request',
      params: { request_id: 'zxcvb', tool_name: 'Bash', description: 'd', input_preview: 'p' }
    })
    await vi.waitFor(() => expect(bridge.sendToAllowedChats).toHaveBeenCalledTimes(2))
    await gateway.tryHandleCallback({
      chatId: 1,
      messageId: 3,
      callbackQueryId: 'q',
      route: { routeId: 'abc123', paneKey: PANE },
      action: 'chp-deny-zxcvb'
    })
    await vi.waitFor(() =>
      expect(sent).toContainEqual({
        jsonrpc: '2.0',
        method: 'notifications/claude/channel/permission',
        params: { request_id: 'zxcvb', behavior: 'deny' }
      })
    )

    await mcp.close()
    expect(gateway.isConnected(PANE)).toBe(false)
  })
})
