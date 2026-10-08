import { afterEach, describe, expect, it, vi } from 'vitest'
import { AgentHookServer, _internals } from '../agent-hooks/server'
import { buildBody, GOOD_PANE, PANE, postHookEvent } from '../agent-hooks/server.test-fixtures'
import { applyClaudeChannelLaunch } from './claude-channel-launch'
import { isClaudeChannelLaunchGranted } from './claude-channel-panes'
import { TelegramChannelGateway } from './telegram-channel-gateway'
import {
  createTelegramChannelHttpHost,
  resolveTelegramChannelEndpoint
} from './telegram-channel-host-client'
import { createTelegramChannelMcpServer } from './telegram-channel-mcp-server'

vi.mock('../telemetry/client', () => ({ track: vi.fn() }))
vi.mock('../telemetry/cohort-classifier', () => ({ getCohortAtEmit: vi.fn(() => ({})) }))

const LAUNCH_TOKEN = 'launch-token-pane-1'
const servers: AgentHookServer[] = []

function createBridge() {
  return {
    sendToAllowedChats: vi.fn(async () => {}),
    createRoute: (paneKey: string) => ({ routeId: 'abc123', paneKey }),
    resolveWorktreeQuery: () => []
  }
}

/** A hook listener whose PANE committed LAUNCH_TOKEN through a status hook. */
async function startHookServer(): Promise<AgentHookServer> {
  _internals.resetCachesForTests()
  const server = new AgentHookServer()
  await server.start({ env: 'production' })
  servers.push(server)
  const response = await postHookEvent(
    server,
    buildBody(
      { hook_event_name: 'UserPromptSubmit', session_id: 'claude-session-1', prompt: 'oi' },
      { launchToken: LAUNCH_TOKEN }
    )
  )
  expect(response.status).toBe(204)
  return server
}

function channelHost(server: AgentHookServer, session: Record<string, string>) {
  return createTelegramChannelHttpHost({
    session: { paneKey: PANE, sessionId: 'session-1', launchToken: LAUNCH_TOKEN, ...session },
    resolveEndpoint: () => resolveTelegramChannelEndpoint(server.buildPtyEnv())
  })
}

afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.setChannelRouteHandler(null)
    await server.stop()
  }
})

describe('telegram channel over the agent-hook listener', () => {
  it('rejects posts without the hook token and 404s when no gateway is registered', async () => {
    const server = await startHookServer()
    const env = server.buildPtyEnv()
    const url = `http://127.0.0.1:${env.DOLPHIN_AGENT_HOOK_PORT}/channel/poll`
    const body = JSON.stringify({ paneKey: PANE, sessionId: 's', launchToken: LAUNCH_TOKEN })
    const headers = { 'Content-Type': 'application/json' }
    expect((await fetch(url, { method: 'POST', headers, body })).status).toBe(403)
    const authed = { ...headers, 'X-Dolphin-Agent-Hook-Token': env.DOLPHIN_AGENT_HOOK_TOKEN }
    expect((await fetch(url, { method: 'POST', headers: authed, body })).status).toBe(404)
  })

  it('refuses a caller that cannot prove the pane it names', async () => {
    const server = await startHookServer()
    const bridge = createBridge()
    const gateway = new TelegramChannelGateway(bridge, { pollHoldMs: 200 })
    server.setChannelRouteHandler(gateway.handleRoute)
    const signal = new AbortController().signal
    const spoofs: Record<string, string>[] = [
      { launchToken: 'some-other-token' },
      { paneKey: GOOD_PANE },
      { launchToken: '' }
    ]
    for (const spoof of spoofs) {
      const host = channelHost(server, spoof)
      await expect(host.poll(signal, 0)).rejects.toThrow('401')
      await expect(host.reply('x')).rejects.toThrow('401')
      await expect(
        host.requestPermission({
          requestId: 'abcde',
          toolName: 'Bash',
          description: '',
          inputPreview: ''
        })
      ).rejects.toThrow('401')
    }
    expect(gateway.isConnected(PANE)).toBe(false)
    expect(bridge.sendToAllowedChats).not.toHaveBeenCalled()
  })

  it('accepts a pane Dolphin launched with the channel before any status hook arrives', async () => {
    const server = await startHookServer()
    const gateway = new TelegramChannelGateway(createBridge(), { pollHoldMs: 100 })
    server.setChannelRouteHandler(gateway.handleRoute, isClaudeChannelLaunchGranted)
    const host = channelHost(server, { paneKey: GOOD_PANE, launchToken: 'fresh-launch' })
    const signal = new AbortController().signal
    await expect(host.poll(signal, 0)).rejects.toThrow('401')
    applyClaudeChannelLaunch(
      {
        command: 'claude',
        env: { DOLPHIN_PANE_KEY: GOOD_PANE, DOLPHIN_AGENT_LAUNCH_TOKEN: 'fresh-launch' },
        launchAgent: 'claude',
        connectionId: null,
        isWsl: false
      },
      { launchArgs: () => '--mcp-config=/c.json' }
    )
    await expect(host.poll(signal, 0)).resolves.toEqual([])
    expect(gateway.isConnected(GOOD_PANE)).toBe(true)
  })

  it('holds a long-poll past the 5s slowloris cap of the listener', async () => {
    const server = await startHookServer()
    const gateway = new TelegramChannelGateway(createBridge(), { pollHoldMs: 7_000 })
    server.setChannelRouteHandler(gateway.handleRoute)
    const host = channelHost(server, {})
    const polled = host.poll(new AbortController().signal, 0)
    await new Promise((resolve) => setTimeout(resolve, 6_000))
    void gateway.tryHandleText({ chatId: 1, messageId: 2, text: 'late' })
    await expect(polled).resolves.toEqual([
      { seq: 1, kind: 'message', text: 'late', meta: { chat_id: '1', message_id: '2' } }
    ])
  }, 15_000)

  it('carries Telegram text in, Claude replies out, and a permission verdict back', async () => {
    const server = await startHookServer()
    const bridge = createBridge()
    const gateway = new TelegramChannelGateway(bridge, { pollHoldMs: 300 })
    server.setChannelRouteHandler(gateway.handleRoute)
    const sent: Record<string, unknown>[] = []
    const mcp = createTelegramChannelMcpServer({
      host: channelHost(server, {}),
      version: 'test',
      send: (message) => sent.push(message)
    })
    mcp.handleMessage({ jsonrpc: '2.0', method: 'notifications/initialized' })
    await vi.waitFor(() => expect(gateway.isConnected(PANE)).toBe(true))

    // Resolves only after the next poll acknowledged it, i.e. Claude really got it.
    await expect(
      gateway.tryHandleText({ chatId: 1, messageId: 2, text: 'status do build?' })
    ).resolves.toEqual({ ok: true, ack: 'Sent to Claude.' })
    expect(sent).toContainEqual({
      jsonrpc: '2.0',
      method: 'notifications/claude/channel',
      params: { content: 'status do build?', meta: { chat_id: '1', message_id: '2' } }
    })

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
