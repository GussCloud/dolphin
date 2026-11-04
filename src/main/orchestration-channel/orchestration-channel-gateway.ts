/**
 * Main-side half of the orchestration channel: the long-poll its server holds open and the push
 * that hands a coordinator a mailbox pointer. Reuses the Telegram channel's acked session queue.
 */
import type { AgentHookChannelRouteHandler } from '../agent-hooks/server/server-channel-route'
import {
  parseTelegramChannelPollRequest,
  parseTelegramChannelSessionRef,
  TELEGRAM_CHANNEL_POLL_HOLD_MS
} from '../telegram/telegram-channel-protocol'
import {
  TelegramChannelSessions,
  type TelegramChannelDelivery
} from '../telegram/telegram-channel-sessions'
import {
  ORCHESTRATION_CHANNEL_DISCONNECT_PATH,
  ORCHESTRATION_CHANNEL_POLL_PATH
} from './orchestration-channel-protocol'

const PUSH_ACK_TIMEOUT_MS = 10_000

export class OrchestrationChannelGateway {
  private readonly sessions: TelegramChannelSessions

  constructor(
    private readonly options: {
      now?: () => number
      pollHoldMs?: number
      ackTimeoutMs?: number
    } = {}
  ) {
    this.sessions = new TelegramChannelSessions(options.now ?? Date.now)
  }

  readonly handleRoute: AgentHookChannelRouteHandler = async ({ pathname, body, signal }) => {
    if (pathname === ORCHESTRATION_CHANNEL_POLL_PATH) {
      const request = parseTelegramChannelPollRequest(body)
      return request
        ? this.sessions.servePoll(
            request,
            signal,
            this.options.pollHoldMs ?? TELEGRAM_CHANNEL_POLL_HOLD_MS
          )
        : { status: 400 }
    }
    if (pathname === ORCHESTRATION_CHANNEL_DISCONNECT_PATH) {
      const ref = parseTelegramChannelSessionRef(body)
      const session = ref ? this.sessions.current(ref) : null
      if (session) {
        this.sessions.retire(session)
      }
      return { status: 204 }
    }
    return { status: 404 }
  }

  /** The live channel session in the pane, so callers can tell a relaunched `claude` apart. */
  connectedSessionId(paneKey: string): string | null {
    return this.sessions.isConnected(paneKey)
      ? (this.sessions.get(paneKey)?.ref.sessionId ?? null)
      : null
  }

  /** `delivered` once the server emitted it to Claude; that is not proof Claude registered it. */
  push(paneKey: string, text: string): Promise<TelegramChannelDelivery> {
    return this.sessions.deliver(
      paneKey,
      text,
      {},
      this.options.ackTimeoutMs ?? PUSH_ACK_TIMEOUT_MS
    )
  }

  dispose(): void {
    this.sessions.retireAll()
  }
}

/** One per main process: the hook listener routes to it and pointer delivery pushes through it. */
export const orchestrationChannelGateway = new OrchestrationChannelGateway()
