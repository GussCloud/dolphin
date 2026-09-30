import { getAzureDevOpsAuthPreference } from './azure-devops-auth-preference-store'
import { getAzureCliTokenExpiresAt } from './azure-cli-session-store'
import { AzureCliNotInstalledError, runAzureCli, runAzureCliJson } from './azure-cli-runner'

// Why long: `az login` waits for the user to finish the browser sign-in.
const LOGIN_TIMEOUT_MS = 5 * 60_000
// Why: a dismissed browser prompt must not reopen on every background request.
const RETRY_COOLDOWN_MS = 15 * 60_000

type RenewalListener = () => void

let inFlight: Promise<boolean> | null = null
let lastFailureAtMs: number | null = null
const listeners = new Set<RenewalListener>()

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

export function shouldRenewAzureCliSession(nowMs: number): boolean {
  const preference = getAzureDevOpsAuthPreference()
  return (
    preference.method === 'azure-cli' &&
    preference.autoRenewCliSession &&
    // Only a lapsed session is renewed; a host that never signed in keeps the manual flow.
    getAzureCliTokenExpiresAt() !== null &&
    hostCanOpenSignInBrowser() &&
    (lastFailureAtMs === null || nowMs - lastFailureAtMs >= RETRY_COOLDOWN_MS)
  )
}

async function readTenantId(): Promise<string | null> {
  try {
    const raw = await runAzureCliJson(['account', 'show'])
    const tenant = raw && typeof raw === 'object' && 'tenantId' in raw ? raw.tenantId : null
    return typeof tenant === 'string' && tenant ? tenant : null
  } catch {
    return null
  }
}

async function runLogin(): Promise<boolean> {
  // Why tenant: keeps the renewed session on the directory the user originally chose.
  const tenant = await readTenantId()
  const result = await runAzureCli(
    ['login', ...(tenant ? ['--tenant', tenant] : []), '--output', 'none'],
    { timeoutMs: LOGIN_TIMEOUT_MS }
  )
  return result.code === 0 && !result.timedOut
}

/**
 * Starts a background `az login` when the host opted into auto-renew and the CLI session
 * lapsed. Single-flight; resolves true once the CLI can sign in again.
 */
export function renewAzureCliSession(nowMs: number = Date.now()): Promise<boolean> {
  if (inFlight) {
    return inFlight
  }
  if (!shouldRenewAzureCliSession(nowMs)) {
    return Promise.resolve(false)
  }
  console.info('[azure-devops] Azure CLI session expired; starting background az login')
  inFlight = runLogin()
    .catch((error: unknown) => {
      if (!(error instanceof AzureCliNotInstalledError)) {
        console.warn('[azure-devops] background az login failed', error)
      }
      return false
    })
    .then((renewed) => {
      lastFailureAtMs = renewed ? null : Date.now()
      if (renewed) {
        for (const listener of listeners) {
          listener()
        }
      }
      return renewed
    })
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

export function onAzureCliSessionRenewed(listener: RenewalListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** @internal - tests need a clean renewal state between cases. */
export function _resetAzureCliSessionRenewal(): void {
  inFlight = null
  lastFailureAtMs = null
  listeners.clear()
}
