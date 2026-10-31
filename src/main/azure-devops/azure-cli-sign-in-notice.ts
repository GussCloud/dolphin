import type { AzureCliSignInState } from '../../shared/azure-devops-auth'
import { getAzureDevOpsAuthPreference } from './azure-devops-auth-preference-store'
import { getAzureCliTokenExpiresAt } from './azure-cli-session-store'

// Owns the desktop sign-in notice for a lapsed Azure CLI session. Dolphin never runs
// `az login` on its own: it raises the notice and waits for the user to click it.

type StateListener = (state: AzureCliSignInState) => void
type RenewalListener = () => void

let state: AzureCliSignInState = { kind: 'idle' }
const stateListeners = new Set<StateListener>()
const renewalListeners = new Set<RenewalListener>()

/** `az login` needs a browser; headless hosts (SSH servers, CI) can only fail or hang. */
export function hostCanOpenSignInBrowser(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  if (platform === 'win32' || platform === 'darwin') {
    return true
  }
  return Boolean(env.DISPLAY || env.WAYLAND_DISPLAY)
}

/** The user opted into the notice; also arms the refresh-token-only keep-alive timer. */
export function isAzureCliSignInNoticeEnabled(): boolean {
  const preference = getAzureDevOpsAuthPreference()
  return preference.method === 'azure-cli' && preference.autoRenewCliSession
}

export function getAzureCliSignInState(): AzureCliSignInState {
  return state
}

export function setAzureCliSignInState(next: AzureCliSignInState): void {
  if (JSON.stringify(next) === JSON.stringify(state)) {
    return
  }
  state = next
  for (const listener of stateListeners) {
    listener(next)
  }
}

export function onAzureCliSignInStateChanged(listener: StateListener): () => void {
  stateListeners.add(listener)
  return () => stateListeners.delete(listener)
}

/** Called when `az` refused to issue a token for a reason other than a timeout. */
export function noticeAzureCliSessionLapsed(): void {
  if (
    state.kind !== 'idle' ||
    !isAzureCliSignInNoticeEnabled() ||
    // Only a lapsed session raises the notice; a host that never signed in keeps the manual flow.
    getAzureCliTokenExpiresAt() === null
  ) {
    return
  }
  console.info('[azure-devops] Azure CLI session expired; showing the sign-in notice')
  setAzureCliSignInState({ kind: 'required' })
}

/** A token was issued again, so any pending notice is stale. */
export function noticeAzureCliSessionWorking(): void {
  if (state.kind === 'required' || state.kind === 'failed') {
    setAzureCliSignInState({ kind: 'idle' })
  }
}

/** The user signed out or turned the notice off; a sign-in in progress keeps its own state. */
export function dismissAzureCliSignInNotice(): void {
  if (state.kind !== 'signing-in') {
    setAzureCliSignInState({ kind: 'idle' })
  }
}

export function notifyAzureCliSessionRenewed(): void {
  for (const listener of renewalListeners) {
    listener()
  }
}

export function onAzureCliSessionRenewed(listener: RenewalListener): () => void {
  renewalListeners.add(listener)
  return () => renewalListeners.delete(listener)
}

/** @internal - tests need a clean notice state between cases. */
export function _resetAzureCliSignInNotice(): void {
  state = { kind: 'idle' }
  stateListeners.clear()
  renewalListeners.clear()
}
