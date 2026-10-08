// The Telegram bridge: subscribes to the agent status store (never a parallel store),
// turns pane transitions into notices, and owns the single getUpdates poller.
import type { AgentHookServer } from '../agent-hooks/server'
import type { EnrichedAgentHookEventPayload } from '../agent-hooks/server/server-types'
import type { AgentStatusClearIpcPayload } from '../../shared/agent-status-types'
import type { TelegramConnectionStatus } from '../../shared/telegram-bridge-state'
import { escapeTelegramHtml } from './telegram-agent-notice'
import { TelegramBotApi } from './telegram-bot-api'
import type {
  TelegramInboundHandler,
  TelegramNoticeDecorator,
  TelegramPaneRoute
} from './telegram-inbound'
import { deliverTelegramNotice, resolveTelegramNotice } from './telegram-notice-delivery'
import {
  TelegramNoticeTransitions,
  telegramStatusEntryFromEnriched
} from './telegram-notice-transitions'
import { TelegramReplyRoutes } from './telegram-reply-routes'
import type { TelegramSettingsStore } from './telegram-settings'
import { formatTelegramStatusList, resolveTelegramWorktreeQuery } from './telegram-status-summary'
import { TelegramUpdatePoller } from './telegram-update-poller'
import { TelegramUpdateRouter } from './telegram-update-router'

export type TelegramStatusSource = Pick<
  AgentHookServer,
  | 'subscribeEnrichedStatus'
  | 'subscribePaneStatusClear'
  | 'subscribeStatusDrop'
  | 'getStatusSnapshot'
>

export type TelegramBridgeApi = Pick<
  TelegramBotApi,
  'getMe' | 'getUpdates' | 'sendMessage' | 'editMessageText' | 'answerCallbackQuery'
>

export type TelegramBridgeDeps = {
  statusSource: TelegramStatusSource
  settings: TelegramSettingsStore
  resolveWorktreeName: (worktreeId: string) => string | null
  createApi?: (token: string) => TelegramBridgeApi
  now?: () => number
}

type ActiveSession = { token: string; api: TelegramBridgeApi; poller: TelegramUpdatePoller }

export class TelegramBridgeService {
  private session: ActiveSession | null = null
  private readonly routes = new TelegramReplyRoutes()
  private readonly transitions = new TelegramNoticeTransitions()
  private readonly handlers: TelegramInboundHandler[] = []
  private readonly decorators: TelegramNoticeDecorator[] = []
  private readonly statusListeners = new Set<(status: TelegramConnectionStatus) => void>()
  private readonly disposers: (() => void)[] = []
  private pollStatus: TelegramConnectionStatus = { state: 'connecting' }
  // Why serial: an edit for "left waiting" must land after the send it edits.
  private outbox: Promise<void> = Promise.resolve()
  private readonly now: () => number
  private readonly router: TelegramUpdateRouter

  constructor(private readonly deps: TelegramBridgeDeps) {
    this.now = deps.now ?? Date.now
    this.router = new TelegramUpdateRouter({
      routes: this.routes,
      isChatAllowed: (chatId) => deps.settings.isChatAllowed(chatId),
      consumePairingCode: (code, chat) => deps.settings.consumePairingCode(code, chat),
      getInboundHandler: (method) =>
        this.handlers.findLast((handler) => handler[method] !== undefined),
      describeStatus: () =>
        formatTelegramStatusList(deps.statusSource.getStatusSnapshot(), deps.resolveWorktreeName),
      reply: async (chatId, html, replyToMessageId) => {
        await this.session?.api.sendMessage(chatId, html, { replyToMessageId })
      },
      answerCallback: async (callbackQueryId, text) => {
        await this.session?.api.answerCallbackQuery(callbackQueryId, text)
      }
    })
  }

  start(): void {
    const { statusSource, settings } = this.deps
    this.disposers.push(
      settings.onChange(() => this.reconcile()),
      statusSource.subscribeEnrichedStatus((enriched) => this.onStatus(enriched)),
      statusSource.subscribePaneStatusClear((clear) => this.onPaneClear(clear)),
      statusSource.subscribeStatusDrop((paneKey) => this.transitions.forget(paneKey))
    )
    this.reconcile()
  }

  dispose(): void {
    for (const dispose of this.disposers.splice(0)) {
      dispose()
    }
    this.stopSession()
  }

  get settings(): TelegramSettingsStore {
    return this.deps.settings
  }

  getConnectionStatus(): TelegramConnectionStatus {
    const snapshot = this.deps.settings.getSnapshot()
    if (!snapshot.enabled) {
      return { state: 'disabled' }
    }
    return this.session ? this.pollStatus : { state: 'not-configured' }
  }

  onConnectionStatus(listener: (status: TelegramConnectionStatus) => void): () => void {
    this.statusListeners.add(listener)
    return () => {
      this.statusListeners.delete(listener)
    }
  }

  /** The most recently registered handler that implements a method receives that event. */
  registerInboundHandler(handler: TelegramInboundHandler): () => void {
    this.handlers.push(handler)
    return () => removeItem(this.handlers, handler)
  }

  registerNoticeDecorator(decorator: TelegramNoticeDecorator): () => void {
    this.decorators.push(decorator)
    return () => removeItem(this.decorators, decorator)
  }

  /** `text` is plain text; the bridge escapes it. Threads under the route's newest notice. */
  async sendToAllowedChats(
    text: string,
    opts?: { replyToRoute?: TelegramPaneRoute }
  ): Promise<void> {
    const api = this.session?.api
    if (!api || !text.trim()) {
      return
    }
    for (const chatId of this.deps.settings.getAllowedChatIds()) {
      const replyToMessageId = opts?.replyToRoute
        ? this.routes.latestMessageFor(opts.replyToRoute.routeId, chatId)
        : undefined
      try {
        await api.sendMessage(chatId, escapeTelegramHtml(text), { replyToMessageId })
      } catch (error) {
        console.warn('[telegram] send to allowed chat failed', error)
      }
    }
  }

  resolveWorktreeQuery(query: string): { worktreeId: string; paneKeys: string[] }[] {
    return resolveTelegramWorktreeQuery(
      query,
      this.deps.statusSource.getStatusSnapshot(),
      this.deps.resolveWorktreeName
    )
  }

  private reconcile(): void {
    const snapshot = this.deps.settings.getSnapshot()
    const token = snapshot.enabled ? this.deps.settings.readToken() : null
    if (this.session && this.session.token === token) {
      this.emitStatus()
      return
    }
    this.stopSession()
    if (token) {
      this.startSession(token)
    }
    this.emitStatus()
  }

  private startSession(token: string): void {
    const api = this.deps.createApi?.(token) ?? new TelegramBotApi(token)
    const poller = new TelegramUpdatePoller({
      api,
      onUpdate: (update) => this.router.route(update),
      onStatus: (status) => {
        this.pollStatus = status
        this.emitStatus()
      }
    })
    this.session = { token, api, poller }
    this.pollStatus = { state: 'connecting' }
    void poller.run()
  }

  private stopSession(): void {
    this.session?.poller.stop()
    this.session = null
    this.transitions.clear()
  }

  private emitStatus(): void {
    const status = this.getConnectionStatus()
    for (const listener of this.statusListeners) {
      try {
        listener(status)
      } catch (error) {
        console.error('[telegram] status listener threw', error)
      }
    }
  }

  private onStatus(enriched: EnrichedAgentHookEventPayload): void {
    const session = this.session
    if (!session || enriched.providerSessionOnly) {
      return
    }
    const entry = telegramStatusEntryFromEnriched(enriched)
    const now = this.now()
    const replay = enriched.isReplay === true
    this.enqueue(async () => {
      if (this.session !== session) {
        return
      }
      const decision = this.transitions.observe(entry, now, replay)
      if (decision.resolve) {
        await resolveTelegramNotice({ api: session.api }, decision.resolve)
      }
      if (!decision.notify) {
        return
      }
      const sent = await deliverTelegramNotice(
        {
          api: session.api,
          routes: this.routes,
          allowedChatIds: () => this.deps.settings.getAllowedChatIds(),
          decorators: () => this.decorators,
          resolveWorktreeName: this.deps.resolveWorktreeName
        },
        entry
      )
      if (sent && (sent.notice.kind === 'blocked' || sent.notice.kind === 'waiting')) {
        this.transitions.recordSent(entry.paneKey, entry.stateStartedAt, {
          kind: sent.notice.kind,
          text: sent.notice.text,
          messages: sent.messages
        })
      }
    })
  }

  private onPaneClear(clear: AgentStatusClearIpcPayload): void {
    // Why: a transient (connection-scoped) clear is lost contact — `unverifiable`, not exited — so it keeps the baseline.
    if ('paneKey' in clear) {
      this.enqueue(async () => this.transitions.forget(clear.paneKey))
    }
  }

  /** Resolves once every queued notice/edit has been attempted. */
  whenIdle(): Promise<void> {
    return this.outbox
  }

  private enqueue(task: () => Promise<void>): void {
    this.outbox = this.outbox.then(task).catch((error: unknown) => {
      console.error('[telegram] bridge task failed', error)
    })
  }
}

function removeItem<T>(items: T[], item: T): void {
  const index = items.indexOf(item)
  if (index !== -1) {
    items.splice(index, 1)
  }
}

let activeTelegramBridge: TelegramBridgeService | null = null

/** The bridge started by main startup; null on hosts that never start it (headless serve). */
export function getTelegramBridge(): TelegramBridgeService | null {
  return activeTelegramBridge
}

export function setTelegramBridge(bridge: TelegramBridgeService | null): void {
  activeTelegramBridge = bridge
}
