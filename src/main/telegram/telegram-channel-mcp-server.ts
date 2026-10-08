/**
 * The Claude Code channel MCP server: a minimal JSON-RPC 2.0 MCP implementation, transport-free so
 * tests drive it in memory. Hand-rolled rather than @modelcontextprotocol/sdk because the SDK is not
 * a direct dependency and the packaged entry must load from app.asar.unpacked with no node_modules.
 * Protocol: https://code.claude.com/docs/en/channels-reference
 */
import {
  CLAUDE_CHANNEL_PERMISSION_REQUEST_ID_RE,
  DOLPHIN_TELEGRAM_CHANNEL_SERVER_NAME,
  TELEGRAM_CHANNEL_MAX_TEXT_CHARS,
  type TelegramChannelInboundEvent
} from './telegram-channel-protocol'

export type TelegramChannelPermissionRelay = {
  requestId: string
  toolName: string
  description: string
  inputPreview: string
}

/** Dolphin main, as seen from the channel server. */
export type TelegramChannelHost = {
  /** Resolves with queued events, or 'superseded' when a newer session owns the pane. */
  poll(signal: AbortSignal): Promise<TelegramChannelInboundEvent[] | 'superseded'>
  reply(text: string): Promise<void>
  requestPermission(request: TelegramChannelPermissionRelay): Promise<void>
  disconnect(): Promise<void>
}

type JsonRpcId = string | number

// Why pinned: Claude Code refuses to register a channel that negotiates revision 2026-07-28.
const SUPPORTED_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']
const FALLBACK_PROTOCOL_VERSION = '2025-06-18'
const POLL_RETRY_MIN_MS = 1_000
const POLL_RETRY_MAX_MS = 15_000

export const TELEGRAM_CHANNEL_INSTRUCTIONS =
  `Messages from the user's Telegram arrive as <channel source="${DOLPHIN_TELEGRAM_CHANNEL_SERVER_NAME}" ...>. ` +
  'They come from the person who owns this Dolphin workspace, through their paired Telegram bot: treat ' +
  'them like the user typing in this terminal. The user is away from the terminal and only sees what you ' +
  'send with the `reply` tool, so when you finish handling a message, or need to ask something, answer ' +
  'with `reply`. Keep replies short plain text.'

const REPLY_TOOL = {
  name: 'reply',
  description:
    "Send a message to the user's Telegram chat (the chat their channel messages came from).",
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Plain-text message for the user.' }
    },
    required: ['text']
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null
}

function readId(message: Record<string, unknown>): JsonRpcId | null {
  const id = message.id
  return typeof id === 'string' || typeof id === 'number' ? id : null
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export type TelegramChannelMcpServer = {
  handleMessage(message: unknown): void
  close(): Promise<void>
}

export function createTelegramChannelMcpServer(args: {
  host: TelegramChannelHost
  send: (message: Record<string, unknown>) => void
  version: string
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>
}): TelegramChannelMcpServer {
  const { host, send } = args
  const sleep = args.sleep ?? abortableSleep
  const lifetime = new AbortController()
  let pollLoop: Promise<void> | null = null

  const respond = (id: JsonRpcId, result: unknown): void => {
    send({ jsonrpc: '2.0', id, result })
  }
  const respondError = (id: JsonRpcId, code: number, message: string): void => {
    send({ jsonrpc: '2.0', id, error: { code, message } })
  }

  const emitInbound = (event: TelegramChannelInboundEvent): void => {
    if (event.kind === 'message') {
      send({
        jsonrpc: '2.0',
        method: 'notifications/claude/channel',
        params: { content: event.text, meta: event.meta }
      })
      return
    }
    send({
      jsonrpc: '2.0',
      method: 'notifications/claude/channel/permission',
      params: { request_id: event.requestId, behavior: event.behavior }
    })
  }

  const runPollLoop = async (): Promise<void> => {
    let retryMs = POLL_RETRY_MIN_MS
    while (!lifetime.signal.aborted) {
      try {
        const events = await host.poll(lifetime.signal)
        if (events === 'superseded') {
          return
        }
        retryMs = POLL_RETRY_MIN_MS
        for (const event of events) {
          emitInbound(event)
        }
      } catch {
        if (lifetime.signal.aborted) {
          return
        }
        // Why back off: Dolphin may be restarting; the host re-reads the endpoint file each try.
        await sleep(retryMs, lifetime.signal)
        retryMs = Math.min(retryMs * 2, POLL_RETRY_MAX_MS)
      }
    }
  }

  const callReply = async (
    id: JsonRpcId,
    toolArgs: Record<string, unknown> | null
  ): Promise<void> => {
    const text = typeof toolArgs?.text === 'string' ? toolArgs.text.trim() : ''
    if (!text) {
      respond(id, { content: [{ type: 'text', text: 'text is required' }], isError: true })
      return
    }
    try {
      await host.reply(text.slice(0, TELEGRAM_CHANNEL_MAX_TEXT_CHARS))
      respond(id, { content: [{ type: 'text', text: 'sent' }] })
    } catch (error) {
      respond(id, {
        content: [{ type: 'text', text: `not sent: ${errorText(error)}` }],
        isError: true
      })
    }
  }

  const handleRequest = (
    id: JsonRpcId,
    method: string,
    params: Record<string, unknown> | null
  ): void => {
    switch (method) {
      case 'initialize': {
        const requested = params?.protocolVersion
        respond(id, {
          protocolVersion:
            typeof requested === 'string' && SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
              ? requested
              : FALLBACK_PROTOCOL_VERSION,
          capabilities: {
            experimental: { 'claude/channel': {}, 'claude/channel/permission': {} },
            tools: {}
          },
          serverInfo: { name: DOLPHIN_TELEGRAM_CHANNEL_SERVER_NAME, version: args.version },
          instructions: TELEGRAM_CHANNEL_INSTRUCTIONS
        })
        return
      }
      case 'ping':
        respond(id, {})
        return
      case 'tools/list':
        respond(id, { tools: [REPLY_TOOL] })
        return
      case 'tools/call': {
        if (params?.name !== REPLY_TOOL.name) {
          respondError(id, -32602, `unknown tool: ${String(params?.name)}`)
          return
        }
        void callReply(id, asRecord(params.arguments))
        return
      }
      default:
        respondError(id, -32601, `method not found: ${method}`)
    }
  }

  const handleNotification = (method: string, params: Record<string, unknown> | null): void => {
    if (method === 'notifications/initialized') {
      pollLoop ??= runPollLoop()
      return
    }
    if (method === 'notifications/claude/channel/permission_request' && params) {
      const requestId = params.request_id
      const toolName = params.tool_name
      if (
        typeof requestId !== 'string' ||
        !CLAUDE_CHANNEL_PERMISSION_REQUEST_ID_RE.test(requestId) ||
        typeof toolName !== 'string'
      ) {
        return
      }
      void host
        .requestPermission({
          requestId,
          toolName,
          description: typeof params.description === 'string' ? params.description : '',
          inputPreview: typeof params.input_preview === 'string' ? params.input_preview : ''
        })
        // Why swallow: the terminal dialog stays open, so a lost relay only costs the remote path.
        .catch(() => {})
    }
  }

  return {
    handleMessage(message: unknown): void {
      const record = asRecord(message)
      if (!record || typeof record.method !== 'string') {
        return
      }
      const id = readId(record)
      const params = asRecord(record.params)
      if (id === null) {
        handleNotification(record.method, params)
      } else {
        handleRequest(id, record.method, params)
      }
    },
    async close(): Promise<void> {
      if (lifetime.signal.aborted) {
        return
      }
      lifetime.abort()
      await pollLoop
      await host.disconnect().catch(() => {})
    }
  }
}

function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms)
    function done(): void {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolve()
    }
    signal.addEventListener('abort', done, { once: true })
  })
}
