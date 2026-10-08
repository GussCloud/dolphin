/**
 * Main-side half of the Claude Code channel: routes Telegram text to the channel connected in a
 * pane, forwards Claude's `reply` calls to the bot, and relays permission prompts both ways. Text
 * a channel cannot take is declined (null) so the terminal.send fallback answers instead.
 */
import type { AgentHookChannelRouteHandler } from '../agent-hooks/server/server-channel-route'
import type {
  TelegramCallbackEvent,
  TelegramInboundResult,
  TelegramNoticeButton,
  TelegramPaneRoute,
  TelegramTextEvent
} from './telegram-inbound'
import { telegramChannelMessages } from './telegram-channel-messages'
import {
  formatChannelPermissionNotice,
  parseChannelPermissionAction,
  parseChannelPermissionText,
  type TelegramChannelPermissionVerdict
} from './telegram-channel-permission-notice'
import {
  parseTelegramChannelPermissionRequest,
  parseTelegramChannelPollRequest,
  parseTelegramChannelReplyRequest,
  parseTelegramChannelSessionRef,
  TELEGRAM_CHANNEL_DISCONNECT_PATH,
  TELEGRAM_CHANNEL_MAX_TEXT_CHARS,
  TELEGRAM_CHANNEL_PERMISSION_REQUEST_PATH,
  TELEGRAM_CHANNEL_POLL_HOLD_MS,
  TELEGRAM_CHANNEL_POLL_PATH,
  TELEGRAM_CHANNEL_REPLY_PATH,
  TELEGRAM_CHANNEL_SUPERSEDED_STATUS,
  type TelegramChannelSessionRef
} from './telegram-channel-protocol'
import { TelegramChannelSessions } from './telegram-channel-sessions'

/** The slice of the Telegram bridge the gateway needs. */
export type TelegramChannelBridgePort = {
  sendToAllowedChats(
    text: string,
    opts?: { replyToRoute?: TelegramPaneRoute; buttons?: TelegramNoticeButton[][] }
  ): Promise<void>
  /** Mints a reply route for the pane, so answering Claude's message in Telegram continues the chat. */
  createRoute(paneKey: string): TelegramPaneRoute
  resolveWorktreeQuery(query: string): { worktreeId: string; paneKeys: string[] }[]
}

type RouteResult = { status: number; json?: unknown }

const MAX_PENDING_PERMISSIONS = 64
const PERMISSION_TTL_MS = 30 * 60_000
const DELIVERY_TIMEOUT_MS = 10_000

export class TelegramChannelGateway {
  private readonly sessions: TelegramChannelSessions
  private readonly pendingPermissions = new Map<
    string,
    { ref: TelegramChannelSessionRef; createdAt: number }
  >()
  private readonly lastRelayAtByPaneKey = new Map<string, number>()
  private readonly now: () => number
  private readonly pollHoldMs: number
  private readonly deliveryTimeoutMs: number
  private readonly attentionPaneKeys: () => string[]

  constructor(
    private readonly bridge: TelegramChannelBridgePort,
    options: {
      now?: () => number
      pollHoldMs?: number
      deliveryTimeoutMs?: number
      /** Panes whose agent waits on the user (blocked/waiting rows), for routing bare text. */
      attentionPaneKeys?: () => string[]
    } = {}
  ) {
    this.now = options.now ?? Date.now
    this.sessions = new TelegramChannelSessions(this.now)
    this.pollHoldMs = options.pollHoldMs ?? TELEGRAM_CHANNEL_POLL_HOLD_MS
    this.deliveryTimeoutMs = options.deliveryTimeoutMs ?? DELIVERY_TIMEOUT_MS
    this.attentionPaneKeys = options.attentionPaneKeys ?? (() => [])
  }

  readonly handleRoute: AgentHookChannelRouteHandler = async ({ pathname, body, signal }) => {
    switch (pathname) {
      case TELEGRAM_CHANNEL_POLL_PATH:
        return this.handlePoll(body, signal)
      case TELEGRAM_CHANNEL_REPLY_PATH:
        return this.handleReply(body)
      case TELEGRAM_CHANNEL_PERMISSION_REQUEST_PATH:
        return this.handlePermissionRequest(body)
      case TELEGRAM_CHANNEL_DISCONNECT_PATH: {
        const ref = parseTelegramChannelSessionRef(body)
        const session = ref ? this.sessions.current(ref) : null
        if (session) {
          this.sessions.retire(session)
        }
        return { status: 204 }
      }
      default:
        return { status: 404 }
    }
  }

  isConnected(paneKey: string): boolean {
    return this.sessions.isConnected(paneKey)
  }

  lastPermissionRelayAt(paneKey: string): number | null {
    return this.lastRelayAtByPaneKey.get(paneKey) ?? null
  }

  /** Null when the text is not for a connected channel, so the terminal fallback runs. */
  async tryHandleText(event: TelegramTextEvent): Promise<TelegramInboundResult | null> {
    const verdict = parseChannelPermissionText(event.text)
    if (verdict && this.pendingPermissions.has(verdict.requestId)) {
      return this.applyVerdict(verdict, null, event.chatId)
    }
    const target = this.resolveTextTarget(event)
    if (target === null || typeof target !== 'string') {
      return target
    }
    const meta = { chat_id: String(event.chatId), message_id: String(event.messageId) }
    const delivery = await this.sessions.deliver(target, event.text, meta, this.deliveryTimeoutMs)
    if (delivery === 'delivered') {
      return { ok: true, ack: telegramChannelMessages.sent() }
    }
    return delivery === 'unconfirmed'
      ? { ok: false, error: telegramChannelMessages.unconfirmed() }
      : null
  }

  async tryHandleCallback(event: TelegramCallbackEvent): Promise<TelegramInboundResult | null> {
    const verdict = parseChannelPermissionAction(event.action)
    return verdict ? this.applyVerdict(verdict, event.route.paneKey, event.chatId) : null
  }

  dispose(): void {
    this.sessions.retireAll()
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
      : this.sessions.connectedPaneKeys()
    if (connected.length > 1) {
      return { ok: false, error: telegramChannelMessages.severalClaudes() }
    }
    if (connected.length === 0) {
      return null
    }
    const [target] = connected
    // Why: bare text goes to the only Claude only when no other agent is waiting on the user.
    const othersWaiting =
      !event.worktreeQuery && this.attentionPaneKeys().some((paneKey) => paneKey !== target)
    return othersWaiting ? { ok: false, error: telegramChannelMessages.replyToNotice() } : target
  }

  private applyVerdict(
    verdict: TelegramChannelPermissionVerdict,
    paneKey: string | null,
    chatId: number
  ): TelegramInboundResult {
    // Why: private chat ids equal the sender's user id; a group member could otherwise approve tools.
    if (chatId <= 0) {
      return { ok: false, error: telegramChannelMessages.privateChatOnly() }
    }
    const pending = this.pendingPermissions.get(verdict.requestId)
    // Why keep it on a pane mismatch: a tap on another pane's notice must not void this request.
    if (!pending || (paneKey !== null && pending.ref.paneKey !== paneKey)) {
      return { ok: false, error: telegramChannelMessages.permissionExpired() }
    }
    this.pendingPermissions.delete(verdict.requestId)
    const session = this.sessions.current(pending.ref)
    if (!session || this.now() - pending.createdAt > PERMISSION_TTL_MS) {
      return { ok: false, error: telegramChannelMessages.permissionExpired() }
    }
    this.sessions.enqueue(session, { kind: 'permission-verdict', ...verdict })
    return {
      ok: true,
      ack:
        verdict.behavior === 'allow'
          ? telegramChannelMessages.allowed()
          : telegramChannelMessages.denied()
    }
  }

  private async handlePoll(body: unknown, signal: AbortSignal): Promise<RouteResult> {
    const request = parseTelegramChannelPollRequest(body)
    if (!request) {
      return { status: 400 }
    }
    const session = this.sessions.claim(request)
    if (!session) {
      return { status: TELEGRAM_CHANNEL_SUPERSEDED_STATUS }
    }
    session.lastPollAt = this.now()
    session.wake?.()
    this.sessions.acknowledge(session, request.ack)
    if (
      session.queue.length === 0 &&
      (await this.sessions.hold(session, this.pollHoldMs, signal)) === 'aborted'
    ) {
      // Why disconnect now: a healthy channel never drops its own poll; its process is gone.
      session.lastPollAt = 0
      return { status: 204 }
    }
    if (this.sessions.current(request) !== session) {
      return { status: TELEGRAM_CHANNEL_SUPERSEDED_STATUS }
    }
    session.lastPollAt = this.now()
    return { status: 200, json: { events: this.sessions.handOut(session) } }
  }

  private async handleReply(body: unknown): Promise<RouteResult> {
    const request = parseTelegramChannelReplyRequest(body)
    if (!request) {
      return { status: 400 }
    }
    if (!this.sessions.current(request)) {
      return { status: TELEGRAM_CHANNEL_SUPERSEDED_STATUS }
    }
    try {
      await this.bridge.sendToAllowedChats(request.text.slice(0, TELEGRAM_CHANNEL_MAX_TEXT_CHARS), {
        replyToRoute: this.bridge.createRoute(request.paneKey)
      })
      return { status: 200, json: { ok: true } }
    } catch (error) {
      console.warn('[telegram-channel] reply failed', error)
      return { status: 502 }
    }
  }

  private async handlePermissionRequest(body: unknown): Promise<RouteResult> {
    const request = parseTelegramChannelPermissionRequest(body)
    if (!request) {
      return { status: 400 }
    }
    if (!this.sessions.current(request)) {
      return { status: TELEGRAM_CHANNEL_SUPERSEDED_STATUS }
    }
    const cutoff = this.now() - PERMISSION_TTL_MS
    for (const [requestId, pending] of this.pendingPermissions) {
      if (pending.createdAt < cutoff || this.pendingPermissions.size >= MAX_PENDING_PERMISSIONS) {
        this.pendingPermissions.delete(requestId)
      }
    }
    const ref = { paneKey: request.paneKey, sessionId: request.sessionId }
    this.lastRelayAtByPaneKey.set(request.paneKey, this.now())
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
}
