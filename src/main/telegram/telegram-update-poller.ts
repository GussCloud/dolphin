// getUpdates long-poll loop. Failures become a connection status and a backoff,
// never a tight retry loop: 409 means another poller owns this bot token.
import type { TelegramConnectionStatus } from '../../shared/telegram-bridge-state'
import { TelegramApiError, type TelegramBotApi, type TelegramUpdate } from './telegram-bot-api'

const LONG_POLL_TIMEOUT_SEC = 30
const CONFLICT_RETRY_MS = 30_000
const NETWORK_BACKOFF_MIN_MS = 2_000
const NETWORK_BACKOFF_MAX_MS = 60_000

export type TelegramUpdatePollerOptions = {
  api: Pick<TelegramBotApi, 'getMe' | 'getUpdates'>
  onUpdate: (update: TelegramUpdate) => Promise<void>
  onStatus: (status: TelegramConnectionStatus) => void
  /** Resume point from the last run; Telegram redelivers everything below it otherwise. */
  initialOffset?: number
  onOffset?: (offset: number) => void
  /** Test seam: resolves after `ms` or when the signal aborts. */
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>
}

function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve()
      return
    }
    const timer = setTimeout(done, ms)
    timer.unref?.()
    function done(): void {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolve()
    }
    signal.addEventListener('abort', done, { once: true })
  })
}

export class TelegramUpdatePoller {
  private readonly controller = new AbortController()
  private offset = 0
  private botUsername: string | undefined
  private readonly sleep: (ms: number, signal: AbortSignal) => Promise<void>

  constructor(private readonly options: TelegramUpdatePollerOptions) {
    this.sleep = options.sleep ?? abortableSleep
    this.offset = options.initialOffset ?? 0
  }

  stop(): void {
    this.controller.abort()
  }

  /** Resolves when stopped, or when the token is rejected (only a settings change can fix that). */
  async run(): Promise<void> {
    const signal = this.controller.signal
    let backoffMs = NETWORK_BACKOFF_MIN_MS
    this.emit({ state: 'connecting' })
    while (!signal.aborted) {
      try {
        if (this.botUsername === undefined) {
          this.botUsername = (await this.options.api.getMe()).username
        }
        const updates = await this.options.api.getUpdates(
          this.offset,
          LONG_POLL_TIMEOUT_SEC,
          signal
        )
        if (signal.aborted) {
          return
        }
        this.emit({ state: 'ok' })
        backoffMs = NETWORK_BACKOFF_MIN_MS
        for (const update of updates) {
          this.offset = Math.max(this.offset, update.updateId + 1)
          try {
            await this.options.onUpdate(update)
          } catch (error) {
            console.error('[telegram] update handler failed', error)
          }
        }
        // Why: a stopped poller may belong to a replaced token; its offset is meaningless for the new bot.
        if (updates.length > 0 && !signal.aborted) {
          this.options.onOffset?.(this.offset)
        }
      } catch (error) {
        if (signal.aborted) {
          return
        }
        if (!(error instanceof TelegramApiError)) {
          this.emit({ state: 'network-error', detail: String(error) })
          await this.sleep(backoffMs, signal)
          backoffMs = Math.min(backoffMs * 2, NETWORK_BACKOFF_MAX_MS)
          continue
        }
        if (error.kind === 'invalid-token') {
          this.emit({ state: 'invalid-token', detail: error.message })
          return
        }
        if (error.kind === 'conflict') {
          this.emit({ state: 'conflict', detail: error.message })
          await this.sleep(CONFLICT_RETRY_MS, signal)
          continue
        }
        if (error.kind === 'rate-limited') {
          await this.sleep((error.retryAfterSec ?? 5) * 1000, signal)
          continue
        }
        this.emit({ state: 'network-error', detail: error.message })
        await this.sleep(backoffMs, signal)
        backoffMs = Math.min(backoffMs * 2, NETWORK_BACKOFF_MAX_MS)
      }
    }
  }

  private emit(status: TelegramConnectionStatus): void {
    if (this.controller.signal.aborted) {
      return
    }
    this.options.onStatus(this.botUsername ? { ...status, botUsername: this.botUsername } : status)
  }
}
