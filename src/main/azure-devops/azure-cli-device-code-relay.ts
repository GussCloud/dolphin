// Relays the code a device-code `az login` prints to the user's phone (Telegram, mobile push),
// and resolves those messages when the attempt ends so a spent code never lingers.
import type { TelegramSentMessage } from '../telegram/telegram-notice-transitions'
import {
  onAzureCliDeviceCodeOutcome,
  onAzureCliDeviceCodePrompt,
  registerAzureCliDeviceCodeChannel,
  type AzureCliDeviceCodeOutcome,
  type AzureCliDeviceCodePrompt
} from './azure-cli-device-code-events'
import {
  azureCliDeviceCodeNewCodeAck,
  azureCliDeviceCodeNewCodeFailed,
  azureCliDeviceCodeNewCodeLabel,
  azureCliDeviceCodeNoLongerNeeded,
  azureCliDeviceCodeOutcomeHtml,
  azureCliDeviceCodePromptHtml,
  azureCliDeviceCodePush
} from './azure-cli-device-code-relay-text'

/** `onTap` returns the short text Telegram shows the user who tapped. */
export type AzureCliDeviceCodeButton = { label: string; onTap: () => string }

export type AzureCliDeviceCodeTelegramPort = {
  /** True when at least one paired chat can receive a message now. */
  canDeliver(): boolean
  send(html: string): Promise<TelegramSentMessage[]>
  /** Rewrites the messages and clears any button they had. */
  edit(messages: readonly TelegramSentMessage[], html: string): Promise<void>
  /** Rewrites the messages with `button`; `release` makes the button inert. */
  offerButton(
    messages: readonly TelegramSentMessage[],
    html: string,
    button: AzureCliDeviceCodeButton
  ): { edited: Promise<void>; release: () => void }
}

export type AzureCliDeviceCodeMobilePort = {
  /** True when a paired phone can be reached by push. */
  canDeliver(): boolean
  notify(notification: { notificationId: string; title: string; body: string }): void
  dismiss(notificationId: string): void
}

export type AzureCliDeviceCodeRelayDeps = {
  telegram: AzureCliDeviceCodeTelegramPort | null
  mobile: AzureCliDeviceCodeMobilePort | null
  hostName: string
  /** Starts a fresh device-code sign-in, or reports one already under way or no longer needed. */
  requestNewCode: () => AzureCliNewCodeRequest
  /** Fires when the session works again or the notice is gone, however that happened. */
  subscribeSessionSettled: (listener: () => void) => () => void
  /** Fires when a sign-in ends in failure; a retry that fails before printing a code emits nothing else. */
  subscribeSignInFailed: (listener: () => void) => () => void
  formatTime: (epochMs: number) => string
}

export type AzureCliNewCodeRequest = 'started' | 'in-progress' | 'not-needed'

export type AzureCliDeviceCodeRelay = {
  /** Resolves open attempts as cancelled, so their messages drop the code. */
  cancelOpenAttempts(): void
  /** Resolves once no attempt is open and no message update is in flight. */
  whenIdle(): Promise<void>
  dispose(): void
}

type RelayedAttempt = {
  telegram: Promise<TelegramSentMessage[]>
  notificationId: string | null
}

type OfferedButton = {
  messages: readonly TelegramSentMessage[]
  html: string
  release: () => void
}

export function azureCliDeviceCodeNotificationId(attemptId: string): string {
  return `azure-cli-device-code:${attemptId}`
}

export function startAzureCliDeviceCodeRelay(
  deps: AzureCliDeviceCodeRelayDeps
): AzureCliDeviceCodeRelay {
  const { telegram, mobile } = deps
  const attempts = new Map<string, RelayedAttempt>()
  const pending = new Set<Promise<void>>()
  const idleWaiters: (() => void)[] = []
  // Why: a "New code" left on a message would start another login once the session no longer needs one.
  let offered: OfferedButton | null = null
  // Set by a tap that started a sign-in; a new prompt clears it, a failure before one reports it.
  let newCodeRequested = false
  // Bumped by every prompt and settle, so a late expiry edit cannot offer a button already withdrawn.
  let generation = 0

  const isIdle = (): boolean => attempts.size === 0 && pending.size === 0
  const wakeIfIdle = (): void => {
    if (isIdle()) {
      for (const wake of idleWaiters.splice(0)) {
        wake()
      }
    }
  }
  const track = (work: Promise<void>): void => {
    const settled = work.catch((error: unknown) =>
      console.warn('[azure-devops] device-code telegram update failed', error)
    )
    pending.add(settled)
    void settled.then(() => {
      pending.delete(settled)
      wakeIfIdle()
    })
  }

  const withdrawOffer = (): void => {
    generation += 1
    const current = offered
    offered = null
    if (current && telegram) {
      current.release()
      track(telegram.edit(current.messages, current.html))
    }
  }

  const relayPrompt = (prompt: AzureCliDeviceCodePrompt): void => {
    newCodeRequested = false
    withdrawOffer()
    const expiresAt = deps.formatTime(prompt.expiresAtMs)
    const html = azureCliDeviceCodePromptHtml(prompt, deps.hostName, expiresAt)
    const sent = telegram?.canDeliver()
      ? telegram.send(html).catch((error: unknown) => {
          console.warn('[azure-devops] device-code telegram send failed', error)
          return []
        })
      : Promise.resolve([])
    let notificationId: string | null = null
    if (mobile?.canDeliver()) {
      notificationId = azureCliDeviceCodeNotificationId(prompt.attemptId)
      mobile.notify({ notificationId, ...azureCliDeviceCodePush(prompt) })
    }
    attempts.set(prompt.attemptId, { telegram: sent, notificationId })
  }

  const newCodeButton: AzureCliDeviceCodeButton = {
    label: azureCliDeviceCodeNewCodeLabel(),
    onTap: () => {
      const request = deps.requestNewCode()
      if (request === 'not-needed') {
        withdrawOffer()
        return azureCliDeviceCodeNoLongerNeeded()
      }
      newCodeRequested ||= request === 'started'
      return azureCliDeviceCodeNewCodeAck()
    }
  }

  const reportNewCodeFailed = (): void => {
    const current = offered
    if (!newCodeRequested || !current || !telegram) {
      return
    }
    newCodeRequested = false
    current.release()
    // Why keep the button: the session still needs a sign-in, so another retry is allowed.
    const offer = telegram.offerButton(
      current.messages,
      `${current.html}\n${azureCliDeviceCodeNewCodeFailed()}`,
      newCodeButton
    )
    offered = { ...current, release: offer.release }
    track(offer.edited)
  }

  const resolveMessages = async (
    outcome: AzureCliDeviceCodeOutcome,
    messages: readonly TelegramSentMessage[],
    generationAtOutcome: number
  ): Promise<void> => {
    if (!telegram || messages.length === 0) {
      return
    }
    const html = azureCliDeviceCodeOutcomeHtml(outcome, deps.hostName)
    const retryable = outcome.outcome === 'expired' || outcome.outcome === 'failed'
    if (!retryable || generation !== generationAtOutcome) {
      await telegram.edit(messages, html)
      return
    }
    const offer = telegram.offerButton(messages, html, newCodeButton)
    offered = { messages, html, release: offer.release }
    await offer.edited
  }

  const resolveAttempt = (outcome: AzureCliDeviceCodeOutcome): void => {
    const attempt = attempts.get(outcome.attemptId)
    if (!attempt) {
      return
    }
    attempts.delete(outcome.attemptId)
    if (attempt.notificationId) {
      mobile?.dismiss(attempt.notificationId)
    }
    const generationAtOutcome = generation
    track(
      attempt.telegram.then((messages) => resolveMessages(outcome, messages, generationAtOutcome))
    )
  }

  const disposers = [
    ...(telegram ? [registerAzureCliDeviceCodeChannel(() => telegram.canDeliver())] : []),
    ...(mobile ? [registerAzureCliDeviceCodeChannel(() => mobile.canDeliver())] : []),
    onAzureCliDeviceCodePrompt(relayPrompt),
    onAzureCliDeviceCodeOutcome(resolveAttempt),
    deps.subscribeSessionSettled(withdrawOffer),
    deps.subscribeSignInFailed(reportNewCodeFailed)
  ]
  return {
    cancelOpenAttempts: () => {
      for (const attemptId of attempts.keys()) {
        resolveAttempt({ attemptId, outcome: 'cancelled' })
      }
    },
    whenIdle: () =>
      isIdle() ? Promise.resolve() : new Promise<void>((resolve) => idleWaiters.push(resolve)),
    dispose: () => {
      for (const dispose of disposers.splice(0)) {
        dispose()
      }
      offered?.release()
      offered = null
      attempts.clear()
      wakeIfIdle()
    }
  }
}

/**
 * Quit path: cancels the sign-in and waits for its 'cancelled' edit; an attempt the cancel did
 * not close within the first half of `budgetMs` is resolved as cancelled here instead.
 */
export async function shutdownAzureCliDeviceCodeRelay(
  relay: AzureCliDeviceCodeRelay,
  cancelSignIn: () => void,
  budgetMs: number
): Promise<void> {
  const waitIdle = (ms: number): Promise<void> =>
    new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, ms)
      timer.unref?.()
      void relay.whenIdle().then(() => {
        clearTimeout(timer)
        resolve()
      })
    })
  try {
    cancelSignIn()
  } catch (error) {
    console.warn('[azure-devops] cancelling the sign-in on quit failed', error)
  }
  await waitIdle(budgetMs / 2)
  relay.cancelOpenAttempts()
  await waitIdle(budgetMs / 2)
  relay.dispose()
}
