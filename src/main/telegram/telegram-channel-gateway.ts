/**
 * Main-side half of the Claude Code channel: tracks the channel server connected in each pane,
 * hands Telegram text to it through a long-poll, forwards Claude's `reply` calls to the bot, and
 * relays permission prompts both ways. A pane without a connected channel is left to the
 * terminal.send fallback (PR2), so every method that can decline returns null.
 */
import type { AgentHookChannelRouteHandler } from '../agent-hooks/server/server-channel-route'
import type {
  TelegramCallbackEvent,
  TelegramInboundResult,
  TelegramNoticeButton,
  TelegramPaneRoute,
  TelegramTextEvent
} from './telegram-inbound'
import {
  escapeTelegramHtml,
  formatChannelPermissionNotice,
  parseChannelPermissionAction,
  parseChannelPermissionText,
  type TelegramChannelPermissionVerdict
} from './telegram-channel-permission-notice'
import {
  parseTelegramChannelPermissionRequest,
  parseTelegramChannelReplyRequest,
  parseTelegramChannelSessionRef,
  TELEGRAM_CHANNEL_DISCONNECT_PATH,
  TELEGRAM_CHANNEL_MAX_TEXT_CHARS,
  TELEGRAM_CHANNEL_PERMISSION_REQUEST_PATH,
  TELEGRAM_CHANNEL_POLL_HOLD_MS,
  TELEGRAM_CHANNEL_POLL_PATH,
  TELEGRAM_CHANNEL_REPLY_PATH,
  TELEGRAM_CHANNEL_SUPERSEDED_STATUS,
  type TelegramChannelInboundEvent,
  type TelegramChannelSessionRef
} from './telegram-channel-protocol'

/** The slice of the Telegram bridge (PR1) the gateway needs. */
export type TelegramChannelBridgePort = {
  sendToAllowedChats(
    text: string,
    opts?: { replyToRoute?: TelegramPaneRoute; buttons?: TelegramNoticeButton[][] }
  ): Promise<void>
  /** Mints a reply route for the pane, so answering Claude's message in Telegram continues the chat. */
  createRoute(paneKey: string): TelegramPaneRoute
  resolveWorktreeQuery(query: string): { worktreeId: string; paneKeys: string[] }[]
}

type ChannelSession = {
  ref: TelegramChannelSessionRef
  lastSeenAt: number
  queue: TelegramChannelInboundEvent[]
  wake: ((events: TelegramChannelInboundEvent[]) => void) | null
}

type PendingPermission = { ref: TelegramChannelSessionRef; createdAt: number }

const MAX_QUEUED_EVENTS = 50
const MAX_PENDING_PERMISSIONS = 64
const MAX_RETIRED_SESSIONS = 256
const PERMISSION_TTL_MS = 30 * 60_000

export class TelegramChannelGateway {
  private readonly sessions = new Map<string, ChannelSession>()
  private readonly retiredSessionIds = new Set<string>()
  private readonly pendingPermissions = new Map<string, PendingPermission>()
  private readonly now: () => number
  private readonly pollHoldMs: number
  private readonly staleAfterMs: number

  constructor(
    private readonly bridge: TelegramChannelBridgePort,
    options: { now?: () => number; pollHoldMs?: number } = {}
  ) {
    this.now = options.now ?? Date.now
    this.pollHoldMs = options.pollHoldMs ?? TELEGRAM_CHANNEL_POLL_HOLD_MS
    // Why the margin: between two polls the server is briefly not waiting but still connected.
    this.staleAfterMs = this.pollHoldMs + 15_000
  }

  readonly handleRoute: AgentHookChannelRouteHandler = async ({ pathname, body, signal }) => {
    switch (pathname) {
      case TELEGRAM_CHANNEL_POLL_PATH:
        return this.handlePoll(body, signal)
      case TELEGRAM_CHANNEL_REPLY_PATH:
        return this.handleReply(body)
      case TELEGRAM_CHANNEL_PERMISSION_REQUEST_PATH:
        return this.handlePermissionRequest(body)
      case TELEGRAM_CHANNEL_DISCONNECT_PATH:
        return this.handleDisconnect(body)
      default:
        return { status: 404 }
    }
  }

  isConnected(paneKey: string): boolean {
    const session = this.sessions.get(paneKey)
    return Boolean(session && (session.wake || this.now() - session.lastSeenAt < this.staleAfterMs))
  }

  connectedPaneKeys(): string[] {
    return [...this.sessions.keys()].filter((paneKey) => this.isConnected(paneKey))
  }

  deliver(paneKey: string, text: string, meta: Record<string, string> = {}): boolean {
    const session = this.sessions.get(paneKey)
    if (!session || !this.isConnected(paneKey) || session.queue.length >= MAX_QUEUED_EVENTS) {
      return false
    }
    this.enqueue(session, {
      kind: 'message',
      text: text.slice(0, TELEGRAM_CHANNEL_MAX_TEXT_CHARS),
      meta
    })
    return true
  }

  /** Null when the text is not for a connected channel, so the terminal fallback runs. */
  async tryHandleText(event: TelegramTextEvent): Promise<TelegramInboundResult | null> {
    const verdict = parseChannelPermissionText(event.text)
    if (verdict && this.pendingPermissions.has(verdict.requestId)) {
      return this.applyVerdict(verdict, null)
    }
    const target = this.resolveTextTarget(event)
    if (target === null || typeof target !== 'string') {
      return target
    }
    const meta = { chat_id: String(event.chatId), message_id: String(event.messageId) }
    return this.deliver(target, event.text, meta) ? { ok: true, ack: 'Enviado ao Claude.' } : null
  }

  async tryHandleCallback(event: TelegramCallbackEvent): Promise<TelegramInboundResult | null> {
    const verdict = parseChannelPermissionAction(event.action)
    return verdict ? this.applyVerdict(verdict, event.route.paneKey) : null
  }

  dispose(): void {
    for (const session of this.sessions.values()) {
      session.wake?.([])
    }
    this.sessions.clear()
    this.pendingPermissions.clear()
  }

  private resolveTextTarget(event: TelegramTextEvent): string | TelegramInboundResult | null {
    if (event.route) {
      return this.isConnected(event.route.paneKey) ? event.route.paneKey : null
    }
    const connected = event.worktreeQuery
      ? this.bridge
          .resolveWorktreeQuery(event.worktreeQuery)
          .flatMap((match) => match.paneKeys)
          .filter((paneKey) => this.isConnected(paneKey))
      : this.connectedPaneKeys()
    if (connected.length === 1) {
      return connected[0]
    }
    if (connected.length > 1) {
      return {
        ok: false,
        error:
          'Mais de um Claude conectado. Responda à mensagem do Claude que deve receber o texto.'
      }
    }
    return null
  }

  private applyVerdict(
    verdict: TelegramChannelPermissionVerdict,
    paneKey: string | null
  ): TelegramInboundResult {
    const pending = this.pendingPermissions.get(verdict.requestId)
    const session = pending ? this.sessions.get(pending.ref.paneKey) : undefined
    if (
      !pending ||
      (paneKey !== null && pending.ref.paneKey !== paneKey) ||
      this.now() - pending.createdAt > PERMISSION_TTL_MS ||
      session?.ref.sessionId !== pending.ref.sessionId
    ) {
      this.pendingPermissions.delete(verdict.requestId)
      return { ok: false, error: 'Pedido de permissão expirado ou já respondido.' }
    }
    this.pendingPermissions.delete(verdict.requestId)
    this.enqueue(session, { kind: 'permission-verdict', ...verdict })
    return { ok: true, ack: verdict.behavior === 'allow' ? 'Permitido.' : 'Negado.' }
  }

  private enqueue(session: ChannelSession, event: TelegramChannelInboundEvent): void {
    session.queue.push(event)
    if (session.wake) {
      const wake = session.wake
      session.wake = null
      wake(session.queue.splice(0))
    }
  }

  /** The current session for the ref's pane, registering a new one; null when the ref was superseded. */
  private claimSession(ref: TelegramChannelSessionRef): ChannelSession | null {
    if (this.retiredSessionIds.has(ref.sessionId)) {
      return null
    }
    const existing = this.sessions.get(ref.paneKey)
    if (existing?.ref.sessionId === ref.sessionId) {
      existing.lastSeenAt = this.now()
      return existing
    }
    if (existing) {
      // Why newest wins: a relaunched `claude` in the same pane replaces the dead server's session.
      this.retireSession(existing)
    }
    const session: ChannelSession = { ref, lastSeenAt: this.now(), queue: [], wake: null }
    this.sessions.set(ref.paneKey, session)
    return session
  }

  private retireSession(session: ChannelSession): void {
    session.wake?.([])
    session.wake = null
    if (this.retiredSessionIds.size >= MAX_RETIRED_SESSIONS) {
      const oldest = this.retiredSessionIds.values().next().value
      if (oldest !== undefined) {
        this.retiredSessionIds.delete(oldest)
      }
    }
    this.retiredSessionIds.add(session.ref.sessionId)
  }

  private currentSession(ref: TelegramChannelSessionRef): ChannelSession | null {
    const session = this.sessions.get(ref.paneKey)
    return session?.ref.sessionId === ref.sessionId ? session : null
  }

  private async handlePoll(
    body: unknown,
    signal: AbortSignal
  ): Promise<{ status: number; json?: unknown }> {
    const ref = parseTelegramChannelSessionRef(body)
    if (!ref) {
      return { status: 400 }
    }
    const session = this.claimSession(ref)
    if (!session) {
      return { status: TELEGRAM_CHANNEL_SUPERSEDED_STATUS }
    }
    session.wake?.([])
    if (session.queue.length > 0) {
      return { status: 200, json: { events: session.queue.splice(0) } }
    }
    const events = await new Promise<TelegramChannelInboundEvent[]>((resolve) => {
      const finish = (drained: TelegramChannelInboundEvent[]): void => {
        clearTimeout(timer)
        signal.removeEventListener('abort', onAbort)
        if (session.wake === finish) {
          session.wake = null
        }
        session.lastSeenAt = this.now()
        resolve(drained)
      }
      const onAbort = (): void => finish([])
      const timer = setTimeout(() => finish([]), this.pollHoldMs)
      signal.addEventListener('abort', onAbort, { once: true })
      session.wake = finish
    })
    if (this.currentSession(ref) !== session) {
      return { status: TELEGRAM_CHANNEL_SUPERSEDED_STATUS }
    }
    return { status: 200, json: { events } }
  }

  private async handleReply(body: unknown): Promise<{ status: number; json?: unknown }> {
    const request = parseTelegramChannelReplyRequest(body)
    if (!request) {
      return { status: 400 }
    }
    if (!this.currentSession(request)) {
      return { status: TELEGRAM_CHANNEL_SUPERSEDED_STATUS }
    }
    const text = escapeTelegramHtml(request.text.slice(0, TELEGRAM_CHANNEL_MAX_TEXT_CHARS))
    try {
      await this.bridge.sendToAllowedChats(text, {
        replyToRoute: this.bridge.createRoute(request.paneKey)
      })
      return { status: 200, json: { ok: true } }
    } catch (error) {
      console.warn('[telegram-channel] reply failed', error)
      return { status: 502 }
    }
  }

  private async handlePermissionRequest(
    body: unknown
  ): Promise<{ status: number; json?: unknown }> {
    const request = parseTelegramChannelPermissionRequest(body)
    if (!request) {
      return { status: 400 }
    }
    if (!this.currentSession(request)) {
      return { status: TELEGRAM_CHANNEL_SUPERSEDED_STATUS }
    }
    this.prunePendingPermissions()
    const ref = { paneKey: request.paneKey, sessionId: request.sessionId }
    this.pendingPermissions.set(request.requestId, { ref, createdAt: this.now() })
    const notice = formatChannelPermissionNotice(request)
    try {
      await this.bridge.sendToAllowedChats(notice.text, {
        replyToRoute: this.bridge.createRoute(request.paneKey),
        buttons: notice.buttons
      })
      return { status: 200, json: { ok: true } }
    } catch (error) {
      this.pendingPermissions.delete(request.requestId)
      console.warn('[telegram-channel] permission relay failed', error)
      return { status: 502 }
    }
  }

  private handleDisconnect(body: unknown): { status: number } {
    const ref = parseTelegramChannelSessionRef(body)
    const session = ref ? this.currentSession(ref) : null
    if (session) {
      this.retireSession(session)
      this.sessions.delete(session.ref.paneKey)
    }
    return { status: 204 }
  }

  private prunePendingPermissions(): void {
    const cutoff = this.now() - PERMISSION_TTL_MS
    for (const [requestId, pending] of this.pendingPermissions) {
      if (pending.createdAt < cutoff || this.pendingPermissions.size >= MAX_PENDING_PERMISSIONS) {
        this.pendingPermissions.delete(requestId)
      }
    }
  }
}
