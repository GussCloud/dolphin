import { randomUUID } from 'node:crypto'
import type { AzureCliSignInResult } from '../../shared/azure-devops-auth'
import {
  emitAzureCliDeviceCodeOutcome,
  emitAzureCliDeviceCodePrompt,
  type AzureCliDeviceCodeOutcome,
  type AzureCliDeviceCodePrompt
} from './azure-cli-device-code-events'
import { parseAzureCliDeviceCodePrompt } from './azure-cli-device-code-prompt'

// Why 15 min: Entra device codes live about that long; az prints no expiry of its own.
const DEVICE_CODE_LIFETIME_MS = 15 * 60_000
// Why the slack: the code's lifetime starts after az's cold start, so az must outlive it.
export const DEVICE_CODE_LOGIN_TIMEOUT_MS = DEVICE_CODE_LIFETIME_MS + 60_000
// Why 60 s: az prints the code after its cold start, which is slow on Windows.
export const DEVICE_CODE_PROMPT_TIMEOUT_MS = 60_000
const MAX_BUFFERED_STDERR = 4096
// Why 70016/authorization_pending: when the code lapses unused, MSAL returns its last poll
// response (still pending) and az exits on its own at the 900 s code lifetime.
const EXPIRED_CODE_PATTERN =
  /AADSTS700(?:16|20)|authorization_pending|expired_token|code (?:has )?expired/i
const PROMPT_CODE_PATTERN = /\bcode\s+[A-Z0-9]{8,12}\b/g
const AUTH_LAPSE_PATTERN = /AADSTS\d+|interaction_required|invalid_grant|az login/i
const NETWORK_FAILURE_PATTERN =
  /HTTPSConnectionPool|Max retries|Failed to resolve|getaddrinfo|ConnectionError|timed out/i

export type DeviceCodeWatch = {
  onStderr: (chunk: string) => void
  /** Set once a prompt reached the relays; an outcome is owed for it. */
  publishedPrompt: () => AzureCliDeviceCodePrompt | null
  dispose: () => void
}

/** Publishes the first device-code prompt az prints; `onMissing` runs if none arrives in time. */
export function watchAzureCliDeviceCodePrompt(handlers: {
  onPrompt: (prompt: AzureCliDeviceCodePrompt) => void
  onMissing: () => void
}): DeviceCodeWatch {
  const attemptId = randomUUID()
  let buffered = ''
  let published: AzureCliDeviceCodePrompt | null = null
  const timer = setTimeout(handlers.onMissing, DEVICE_CODE_PROMPT_TIMEOUT_MS)
  timer.unref?.()
  return {
    onStderr: (chunk) => {
      if (published) {
        return
      }
      buffered = (buffered + chunk).slice(-MAX_BUFFERED_STDERR)
      // Why whole lines only: a chunk boundary inside the code would publish a truncated one.
      const complete = buffered.slice(0, buffered.lastIndexOf('\n') + 1)
      const parsed = complete ? parseAzureCliDeviceCodePrompt(complete) : null
      if (!parsed) {
        return
      }
      clearTimeout(timer)
      published = { attemptId, ...parsed, expiresAtMs: Date.now() + DEVICE_CODE_LIFETIME_MS }
      emitAzureCliDeviceCodePrompt(published)
      handlers.onPrompt(published)
    },
    publishedPrompt: () => published,
    dispose: () => clearTimeout(timer)
  }
}

/**
 * Whether a refused token looks like a lapsed sign-in that a new `az login` would fix, as
 * opposed to an offline host or a broken install, which a login cannot repair.
 */
export function isAzureCliSignInLapse(stderr: string): boolean {
  return AUTH_LAPSE_PATTERN.test(stderr) && !NETWORK_FAILURE_PATTERN.test(stderr)
}

export function isDeviceCodeExpiry(stderr: string, timedOut: boolean): boolean {
  return timedOut || EXPIRED_CODE_PATTERN.test(stderr)
}

/** Strips the one-time code from an error; az's last stderr line can be the prompt itself. */
export function redactDeviceCode(text: string, userCode: string | null): string {
  const generic = text.replace(PROMPT_CODE_PATTERN, 'code •••')
  return userCode ? generic.split(userCode).join('•••') : generic
}

export function reportAzureCliDeviceCodeOutcome(
  watch: DeviceCodeWatch,
  result: AzureCliSignInResult,
  flags: { cancelled: boolean; expired: boolean }
): void {
  const attemptId = watch.publishedPrompt()?.attemptId
  if (!attemptId) {
    return
  }
  let outcome: AzureCliDeviceCodeOutcome['outcome'] = 'failed'
  if (result.ok) {
    outcome = 'renewed'
  } else if (flags.cancelled) {
    outcome = 'cancelled'
  } else if (flags.expired) {
    outcome = 'expired'
  }
  emitAzureCliDeviceCodeOutcome({
    attemptId,
    outcome,
    ...(result.ok || outcome === 'cancelled' ? {} : { error: result.error })
  })
}
