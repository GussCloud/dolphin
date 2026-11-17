import { hasAzureCliDeviceCodeChannel } from './azure-cli-device-code-events'
import { isAzureCliSignInLapse } from './azure-cli-device-code-sign-in'
import {
  claimAzureCliAutomaticSignIn,
  noticeAzureCliSessionLapsed
} from './azure-cli-sign-in-notice'

// Why registered, not imported: the sign-in module opens Electron windows, and the token path
// that calls this is reachable from the plain-Node runtime. Unregistered hosts only get the notice.
let automaticSignIn: (() => Promise<void>) | null = null

export function registerAzureCliAutomaticSignIn(start: () => Promise<void>): () => void {
  automaticSignIn = start
  return () => {
    if (automaticSignIn === start) {
      automaticSignIn = null
    }
  }
}

/**
 * Raises the notice for a refused token and, once per lapse, starts a device-code sign-in
 * when the refusal is a lapsed sign-in and a phone channel can deliver the code.
 */
export function handleAzureCliSessionLapsed(stderr: string): void {
  noticeAzureCliSessionLapsed()
  const start = automaticSignIn
  if (
    !start ||
    !isAzureCliSignInLapse(stderr) ||
    !hasAzureCliDeviceCodeChannel() ||
    !claimAzureCliAutomaticSignIn()
  ) {
    return
  }
  void start().catch((error: unknown) =>
    console.warn('[azure-devops] automatic device-code sign-in failed', error)
  )
}
