/**
 * The channel server's side of the loopback link to Dolphin main: the same agent-hook listener and
 * token that hook scripts use. Electron-free; runs inside the channel entry.
 */
import { readFileSync } from 'node:fs'
import { request } from 'node:http'
import type { TelegramChannelHost } from './telegram-channel-mcp-server'
import {
  parseTelegramChannelPollResponse,
  TELEGRAM_CHANNEL_DISCONNECT_PATH,
  TELEGRAM_CHANNEL_PERMISSION_REQUEST_PATH,
  TELEGRAM_CHANNEL_POLL_HOLD_MS,
  TELEGRAM_CHANNEL_POLL_PATH,
  TELEGRAM_CHANNEL_REPLY_PATH,
  TELEGRAM_CHANNEL_SUPERSEDED_STATUS,
  type TelegramChannelSessionRef
} from './telegram-channel-protocol'

export type TelegramChannelEndpoint = { port: number; token: string }

export type TelegramChannelPostJson = (
  endpoint: TelegramChannelEndpoint,
  path: string,
  body: unknown,
  options: { timeoutMs: number; signal?: AbortSignal }
) => Promise<{ status: number; body: unknown }>

const REQUEST_TIMEOUT_MS = 10_000

function parseEndpointLines(text: string): Record<string, string> {
  const values: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) {
    const match = /^(?:set )?(DOLPHIN_AGENT_HOOK_[A-Z_]+)=(.*)$/.exec(line.trim())
    if (match) {
      values[match[1]] = match[2]
    }
  }
  return values
}

function toEndpoint(
  port: string | undefined,
  token: string | undefined
): TelegramChannelEndpoint | null {
  const parsedPort = Number(port)
  return Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort < 65_536 && token
    ? { port: parsedPort, token }
    : null
}

/** The endpoint file wins over PTY env because it follows a Dolphin restart; env is the fallback. */
export function resolveTelegramChannelEndpoint(
  env: NodeJS.ProcessEnv,
  readFile: (path: string) => string = (path) => readFileSync(path, 'utf8')
): TelegramChannelEndpoint | null {
  const endpointPath = env.DOLPHIN_AGENT_HOOK_ENDPOINT
  if (endpointPath) {
    try {
      const values = parseEndpointLines(readFile(endpointPath))
      const fromFile = toEndpoint(values.DOLPHIN_AGENT_HOOK_PORT, values.DOLPHIN_AGENT_HOOK_TOKEN)
      if (fromFile) {
        return fromFile
      }
    } catch {
      // Fall through to the PTY env.
    }
  }
  return toEndpoint(env.DOLPHIN_AGENT_HOOK_PORT, env.DOLPHIN_AGENT_HOOK_TOKEN)
}

export const postLoopbackJson: TelegramChannelPostJson = (endpoint, path, body, options) =>
  new Promise((resolve, reject) => {
    const payload = Buffer.from(JSON.stringify(body), 'utf8')
    const req = request(
      {
        host: '127.0.0.1',
        port: endpoint.port,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': payload.length,
          'X-Dolphin-Agent-Hook-Token': endpoint.token
        },
        timeout: options.timeoutMs,
        signal: options.signal
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          let parsed: unknown = null
          try {
            parsed = text ? JSON.parse(text) : null
          } catch {
            parsed = null
          }
          resolve({ status: res.statusCode ?? 0, body: parsed })
        })
        res.on('error', reject)
      }
    )
    req.on('timeout', () => req.destroy(new Error('timeout')))
    req.on('error', reject)
    req.end(payload)
  })

export function createTelegramChannelHttpHost(args: {
  /** `launchToken` proves the pane to main (DOLPHIN_AGENT_LAUNCH_TOKEN, as hook scripts send it). */
  session: TelegramChannelSessionRef & { launchToken: string }
  resolveEndpoint: () => TelegramChannelEndpoint | null
  postJson?: TelegramChannelPostJson
}): TelegramChannelHost {
  const postJson = args.postJson ?? postLoopbackJson
  const post = async (
    path: string,
    body: Record<string, unknown>,
    options: { timeoutMs: number; signal?: AbortSignal }
  ): Promise<{ status: number; body: unknown }> => {
    const endpoint = args.resolveEndpoint()
    if (!endpoint) {
      throw new Error('Dolphin is not reachable from this terminal')
    }
    return postJson(endpoint, path, { ...args.session, ...body }, options)
  }
  const expectOk = (result: { status: number }): void => {
    if (result.status < 200 || result.status >= 300) {
      throw new Error(`Dolphin answered ${result.status}`)
    }
  }
  return {
    async poll(signal, ack) {
      const result = await post(
        TELEGRAM_CHANNEL_POLL_PATH,
        { ack },
        { timeoutMs: TELEGRAM_CHANNEL_POLL_HOLD_MS + REQUEST_TIMEOUT_MS, signal }
      )
      if (result.status === TELEGRAM_CHANNEL_SUPERSEDED_STATUS) {
        return 'superseded'
      }
      expectOk(result)
      return parseTelegramChannelPollResponse(result.body)
    },
    async reply(text) {
      expectOk(await post(TELEGRAM_CHANNEL_REPLY_PATH, { text }, { timeoutMs: REQUEST_TIMEOUT_MS }))
    },
    async requestPermission(request) {
      expectOk(
        await post(TELEGRAM_CHANNEL_PERMISSION_REQUEST_PATH, request, {
          timeoutMs: REQUEST_TIMEOUT_MS
        })
      )
    },
    async disconnect() {
      await post(TELEGRAM_CHANNEL_DISCONNECT_PATH, {}, { timeoutMs: 2_000 })
    }
  }
}
