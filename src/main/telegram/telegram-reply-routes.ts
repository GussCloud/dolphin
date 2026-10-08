// Short route ids stand in for pane identity inside Telegram's 64-byte callback_data,
// and map our sent notices back to panes when the user replies to one.
import { randomInt } from 'node:crypto'
import type { TelegramPaneRoute } from './telegram-inbound'

const ROUTE_ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const ROUTE_ID_LENGTH = 8
const ROUTE_ID_PATTERN = /^[A-Za-z0-9]{6,10}$/
const CALLBACK_DATA_MAX_BYTES = 64
const DEFAULT_ROUTE_CAPACITY = 500

function generateRouteId(): string {
  let id = ''
  for (let i = 0; i < ROUTE_ID_LENGTH; i += 1) {
    id += ROUTE_ID_ALPHABET[randomInt(ROUTE_ID_ALPHABET.length)]
  }
  return id
}

export function encodeTelegramCallbackData(routeId: string, action: string): string {
  const data = `${routeId}:${action}`
  if (Buffer.byteLength(data, 'utf8') > CALLBACK_DATA_MAX_BYTES) {
    throw new Error(`Telegram callback_data exceeds ${CALLBACK_DATA_MAX_BYTES} bytes`)
  }
  return data
}

function messageKey(chatId: number, messageId: number): string {
  return `${chatId}:${messageId}`
}

/** Bounded insertion-ordered registry; the oldest routes fall off first. */
export class TelegramReplyRoutes {
  private readonly routes = new Map<string, TelegramPaneRoute>()
  private readonly routeByMessage = new Map<string, string>()

  constructor(
    private readonly capacity = DEFAULT_ROUTE_CAPACITY,
    private readonly nextRouteId: () => string = generateRouteId
  ) {}

  register(route: Omit<TelegramPaneRoute, 'routeId'>): TelegramPaneRoute {
    let routeId = this.nextRouteId()
    while (this.routes.has(routeId)) {
      routeId = this.nextRouteId()
    }
    const registered: TelegramPaneRoute = { ...route, routeId }
    this.routes.set(routeId, registered)
    while (this.routes.size > this.capacity) {
      const oldest = this.routes.keys().next()
      if (oldest.done) {
        break
      }
      this.forget(oldest.value)
    }
    return registered
  }

  get(routeId: string): TelegramPaneRoute | undefined {
    return this.routes.get(routeId)
  }

  bindMessage(chatId: number, messageId: number, routeId: string): void {
    if (this.routes.has(routeId)) {
      this.routeByMessage.set(messageKey(chatId, messageId), routeId)
    }
  }

  resolveMessage(chatId: number, messageId: number): TelegramPaneRoute | undefined {
    const routeId = this.routeByMessage.get(messageKey(chatId, messageId))
    return routeId ? this.routes.get(routeId) : undefined
  }

  /** Newest message bound to the route in that chat, for threading follow-ups under a notice. */
  latestMessageFor(routeId: string, chatId: number): number | undefined {
    let latest: number | undefined
    for (const [key, value] of this.routeByMessage) {
      const [keyChat, keyMessage] = key.split(':').map(Number)
      if (
        value === routeId &&
        keyChat === chatId &&
        (latest === undefined || keyMessage > latest)
      ) {
        latest = keyMessage
      }
    }
    return latest
  }

  /** `${routeId}:${action}` -> live route + action; null when malformed or evicted. */
  parseCallbackData(data: string): { route: TelegramPaneRoute; action: string } | null {
    const separator = data.indexOf(':')
    if (separator === -1) {
      return null
    }
    const routeId = data.slice(0, separator)
    if (!ROUTE_ID_PATTERN.test(routeId)) {
      return null
    }
    const route = this.routes.get(routeId)
    return route ? { route, action: data.slice(separator + 1) } : null
  }

  private forget(routeId: string): void {
    this.routes.delete(routeId)
    for (const [key, value] of this.routeByMessage) {
      if (value === routeId) {
        this.routeByMessage.delete(key)
      }
    }
  }
}
