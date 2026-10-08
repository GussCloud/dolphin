/**
 * The channel server connected in each pane and its acknowledged event queue. Events carry a
 * per-session `seq`; a poll's `ack` drops what the server already emitted, and everything still
 * queued is (re)sent, so a response lost in flight is never a lost message.
 */
import {
  TELEGRAM_CHANNEL_MAX_TEXT_CHARS,
  TELEGRAM_CHANNEL_STALE_AFTER_MS,
  type TelegramChannelInboundEvent,
  type TelegramChannelSessionRef
} from './telegram-channel-protocol'

/** `unconfirmed`: handed to the channel but never acknowledged, so it may or may not have arrived. */
export type TelegramChannelDelivery = 'delivered' | 'not-connected' | 'unconfirmed'

export type InboundEventBody =
  | { kind: 'message'; text: string; meta: Record<string, string> }
  | { kind: 'permission-verdict'; requestId: string; behavior: 'allow' | 'deny' }

type QueuedEvent = {
  event: TelegramChannelInboundEvent
  handedOut: boolean
  settle?: (outcome: 'acked' | 'dropped') => void
}

export type ChannelSession = {
  ref: TelegramChannelSessionRef
  lastPollAt: number
  nextSeq: number
  queue: QueuedEvent[]
  wake: (() => void) | null
}

const MAX_QUEUED_EVENTS = 50
const MAX_RETIRED_SESSIONS = 256

export class TelegramChannelSessions {
  private readonly sessions = new Map<string, ChannelSession>()
  private readonly retiredSessionIds = new Set<string>()

  constructor(private readonly now: () => number) {}

  get(paneKey: string): ChannelSession | undefined {
    return this.sessions.get(paneKey)
  }

  isConnected(paneKey: string): boolean {
    const session = this.sessions.get(paneKey)
    return Boolean(
      session && (session.wake || this.now() - session.lastPollAt < TELEGRAM_CHANNEL_STALE_AFTER_MS)
    )
  }

  connectedPaneKeys(): string[] {
    return [...this.sessions.keys()].filter((paneKey) => this.isConnected(paneKey))
  }

  /** The current session for the ref, or null when the ref is not the pane's live session. */
  current(ref: TelegramChannelSessionRef): ChannelSession | null {
    const session = this.sessions.get(ref.paneKey)
    return session?.ref.sessionId === ref.sessionId ? session : null
  }

  /** Registers the ref as its pane's session; null when a newer one already superseded it. */
  claim(ref: TelegramChannelSessionRef): ChannelSession | null {
    if (this.retiredSessionIds.has(ref.sessionId)) {
      return null
    }
    const existing = this.sessions.get(ref.paneKey)
    if (existing?.ref.sessionId === ref.sessionId) {
      return existing
    }
    if (existing) {
      // Why newest wins: a relaunched `claude` in the same pane replaces the dead server's session.
      this.retire(existing)
    }
    // Why seq starts at 1: the server's initial ack is 0.
    const session: ChannelSession = { ref, lastPollAt: 0, nextSeq: 1, queue: [], wake: null }
    this.sessions.set(ref.paneKey, session)
    return session
  }

  retire(session: ChannelSession): void {
    session.wake?.()
    session.wake = null
    for (const queued of session.queue) {
      queued.settle?.('dropped')
    }
    session.queue = []
    if (this.sessions.get(session.ref.paneKey) === session) {
      this.sessions.delete(session.ref.paneKey)
    }
    if (this.retiredSessionIds.size >= MAX_RETIRED_SESSIONS) {
      const oldest = this.retiredSessionIds.values().next().value
      if (oldest !== undefined) {
        this.retiredSessionIds.delete(oldest)
      }
    }
    this.retiredSessionIds.add(session.ref.sessionId)
  }

  retireAll(): void {
    // Deleting the visited entry during Map iteration is safe.
    for (const session of this.sessions.values()) {
      this.retire(session)
    }
  }

  enqueue(session: ChannelSession, body: InboundEventBody): QueuedEvent {
    const queued: QueuedEvent = { event: { ...body, seq: session.nextSeq++ }, handedOut: false }
    session.queue.push(queued)
    session.wake?.()
    return queued
  }

  /** Resolves once the channel acknowledged the text, or why it could not. */
  deliver(
    paneKey: string,
    text: string,
    meta: Record<string, string>,
    timeoutMs: number
  ): Promise<TelegramChannelDelivery> {
    const session = this.sessions.get(paneKey)
    if (!session || !this.isConnected(paneKey) || session.queue.length >= MAX_QUEUED_EVENTS) {
      return Promise.resolve('not-connected')
    }
    return new Promise((resolve) => {
      const queued = this.enqueue(session, {
        kind: 'message',
        text: text.slice(0, TELEGRAM_CHANNEL_MAX_TEXT_CHARS),
        meta
      })
      const unacked = (): TelegramChannelDelivery =>
        queued.handedOut ? 'unconfirmed' : 'not-connected'
      const timer = setTimeout(() => {
        // Why withdraw only unsent text: once handed out it may already be in Claude's context.
        if (!queued.handedOut) {
          session.queue = session.queue.filter((item) => item !== queued)
        }
        queued.settle = undefined
        resolve(unacked())
      }, timeoutMs)
      queued.settle = (outcome) => {
        clearTimeout(timer)
        resolve(outcome === 'acked' ? 'delivered' : unacked())
      }
    })
  }

  /** Drops what the channel already emitted. */
  acknowledge(session: ChannelSession, ack: number): void {
    const remaining: QueuedEvent[] = []
    for (const queued of session.queue) {
      if (queued.event.seq <= ack) {
        queued.settle?.('acked')
      } else {
        remaining.push(queued)
      }
    }
    session.queue = remaining
  }

  handOut(session: ChannelSession): TelegramChannelInboundEvent[] {
    for (const queued of session.queue) {
      queued.handedOut = true
    }
    return session.queue.map((queued) => queued.event)
  }

  /** Holds until an event is queued, the hold elapses, or the client drops the request. */
  hold(session: ChannelSession, holdMs: number, signal: AbortSignal): Promise<'woken' | 'aborted'> {
    return new Promise((resolve) => {
      const finish = (value: 'woken' | 'aborted'): void => {
        clearTimeout(timer)
        signal.removeEventListener('abort', onAbort)
        if (session.wake === wake) {
          session.wake = null
        }
        resolve(value)
      }
      const wake = (): void => finish('woken')
      const onAbort = (): void => finish('aborted')
      const timer = setTimeout(wake, holdMs)
      signal.addEventListener('abort', onAbort, { once: true })
      session.wake = wake
    })
  }
}
