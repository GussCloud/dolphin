/**
 * Wire contract between the Claude Code channel MCP server (a plain-Node child of `claude`) and
 * Dolphin main, carried over the agent-hook loopback listener. Must stay electron-free: the
 * channel entry imports it.
 */

/** MCP server name; also the `server:<name>` the development-channels flag opts in. */
export const DOLPHIN_TELEGRAM_CHANNEL_SERVER_NAME = 'dolphin-telegram'

export const TELEGRAM_CHANNEL_POLL_PATH = '/channel/poll'
export const TELEGRAM_CHANNEL_REPLY_PATH = '/channel/reply'
export const TELEGRAM_CHANNEL_PERMISSION_REQUEST_PATH = '/channel/permission-request'
export const TELEGRAM_CHANNEL_DISCONNECT_PATH = '/channel/disconnect'

/** Main holds a poll this long before answering with no events. */
export const TELEGRAM_CHANNEL_POLL_HOLD_MS = 25_000

export const TELEGRAM_CHANNEL_MAX_TEXT_CHARS = 4_000

/** Claude Code's permission request ids: five lowercase letters, never `l`. */
export const CLAUDE_CHANNEL_PERMISSION_REQUEST_ID_RE = /^[a-km-z]{5}$/

export type TelegramChannelSessionRef = {
  paneKey: string
  /** Random per channel-server process, so a relaunched `claude` supersedes the old one. */
  sessionId: string
}

export type TelegramChannelInboundEvent =
  | { kind: 'message'; text: string; meta: Record<string, string> }
  | { kind: 'permission-verdict'; requestId: string; behavior: 'allow' | 'deny' }

export type TelegramChannelPollResponse = {
  events: TelegramChannelInboundEvent[]
}

export type TelegramChannelReplyRequest = TelegramChannelSessionRef & { text: string }

export type TelegramChannelPermissionRequest = TelegramChannelSessionRef & {
  requestId: string
  toolName: string
  description: string
  inputPreview: string
}

/** Status main answers when a newer channel session owns the pane; the old server stops polling. */
export const TELEGRAM_CHANNEL_SUPERSEDED_STATUS = 409

function readString(
  record: Record<string, unknown>,
  key: string,
  maxLength: number
): string | null {
  const value = record[key]
  return typeof value === 'string' && value.length <= maxLength ? value : null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null
}

export function parseTelegramChannelSessionRef(body: unknown): TelegramChannelSessionRef | null {
  const record = asRecord(body)
  if (!record) {
    return null
  }
  const paneKey = readString(record, 'paneKey', 200)
  const sessionId = readString(record, 'sessionId', 100)
  return paneKey && sessionId ? { paneKey, sessionId } : null
}

export function parseTelegramChannelReplyRequest(
  body: unknown
): TelegramChannelReplyRequest | null {
  const ref = parseTelegramChannelSessionRef(body)
  const record = asRecord(body)
  const text = record ? readString(record, 'text', 64_000) : null
  return ref && text !== null && text.trim() ? { ...ref, text } : null
}

export function parseTelegramChannelPermissionRequest(
  body: unknown
): TelegramChannelPermissionRequest | null {
  const ref = parseTelegramChannelSessionRef(body)
  const record = asRecord(body)
  if (!ref || !record) {
    return null
  }
  const requestId = readString(record, 'requestId', 16)
  const toolName = readString(record, 'toolName', 256)
  const description = readString(record, 'description', 16_000) ?? ''
  const inputPreview = readString(record, 'inputPreview', 64_000) ?? ''
  if (!requestId || !CLAUDE_CHANNEL_PERMISSION_REQUEST_ID_RE.test(requestId) || !toolName) {
    return null
  }
  return { ...ref, requestId, toolName, description, inputPreview }
}

export function parseTelegramChannelPollResponse(body: unknown): TelegramChannelInboundEvent[] {
  const record = asRecord(body)
  const events = record?.events
  if (!Array.isArray(events)) {
    return []
  }
  const parsed: TelegramChannelInboundEvent[] = []
  for (const raw of events) {
    const event = asRecord(raw)
    if (event?.kind === 'message' && typeof event.text === 'string') {
      const meta = asRecord(event.meta) ?? {}
      parsed.push({
        kind: 'message',
        text: event.text,
        meta: Object.fromEntries(
          Object.entries(meta).filter(
            (entry): entry is [string, string] =>
              typeof entry[1] === 'string' && /^\w+$/.test(entry[0])
          )
        )
      })
    } else if (
      event?.kind === 'permission-verdict' &&
      typeof event.requestId === 'string' &&
      CLAUDE_CHANNEL_PERMISSION_REQUEST_ID_RE.test(event.requestId) &&
      (event.behavior === 'allow' || event.behavior === 'deny')
    ) {
      parsed.push({
        kind: 'permission-verdict',
        requestId: event.requestId,
        behavior: event.behavior
      })
    }
  }
  return parsed
}
