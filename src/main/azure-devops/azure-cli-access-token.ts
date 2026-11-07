import { AZURE_DEVOPS_ENTRA_RESOURCE_ID } from '../../shared/azure-devops-auth'
import { AzureCliCommandError, runAzureCliJson } from './azure-cli-runner'
import { recordAzureCliTokenExpiry } from './azure-cli-session-store'
import {
  isAzureCliSignInNoticeEnabled,
  noticeAzureCliSessionLapsed,
  noticeAzureCliSessionWorking
} from './azure-cli-sign-in-notice'

// Refresh this long before expiry so an in-flight request never carries a dead token.
const EXPIRY_SAFETY_MARGIN_MS = 5 * 60_000

type CachedToken = { accessToken: string; expiresAtMs: number }

let cachedToken: CachedToken | null = null
let inFlight: Promise<CachedToken> | null = null
let proactiveRefreshTimer: ReturnType<typeof setTimeout> | null = null

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? Object.fromEntries(Object.entries(value)) : null
}

export function parseAzureCliAccessToken(value: unknown, nowMs: number): CachedToken | null {
  const record = readRecord(value)
  const accessToken = record?.accessToken
  if (typeof accessToken !== 'string' || !accessToken) {
    return null
  }
  // `expires_on` (epoch seconds) is timezone-safe; `expiresOn` is local time without an offset.
  const epochSeconds = Number(record?.expires_on)
  const expiresAtMs = Number.isFinite(epochSeconds)
    ? epochSeconds * 1000
    : Date.parse(String(record?.expiresOn ?? '')) || nowMs + 30 * 60_000
  return { accessToken, expiresAtMs }
}

// Why: refreshing before expiry keeps the CLI refresh token in use, so an opted-in
// session does not lapse while Dolphin sits idle.
function scheduleProactiveRefresh(expiresAtMs: number): void {
  if (proactiveRefreshTimer) {
    clearTimeout(proactiveRefreshTimer)
  }
  const delayMs = Math.max(60_000, expiresAtMs - EXPIRY_SAFETY_MARGIN_MS - Date.now())
  proactiveRefreshTimer = setTimeout(() => {
    proactiveRefreshTimer = null
    if (isAzureCliSignInNoticeEnabled()) {
      void getAzureCliAccessToken().catch(() => undefined)
    }
  }, delayMs)
  proactiveRefreshTimer.unref?.()
}

async function acquire(): Promise<CachedToken> {
  let raw: unknown
  try {
    raw = await runAzureCliJson([
      'account',
      'get-access-token',
      '--resource',
      AZURE_DEVOPS_ENTRA_RESOURCE_ID
    ])
  } catch (error) {
    // Why only the notice: `az login` opens a browser, so it runs after the user clicks.
    if (error instanceof AzureCliCommandError && !error.result.timedOut) {
      noticeAzureCliSessionLapsed()
    }
    throw error
  }
  const token = parseAzureCliAccessToken(raw, Date.now())
  if (!token) {
    throw new Error('Azure CLI returned no access token')
  }
  recordAzureCliTokenExpiry(token.expiresAtMs)
  noticeAzureCliSessionWorking()
  if (isAzureCliSignInNoticeEnabled()) {
    scheduleProactiveRefresh(token.expiresAtMs)
  }
  return token
}

/** Entra ID bearer token for Azure DevOps from the signed-in Azure CLI; throws when signed out. */
export async function getAzureCliAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAtMs - EXPIRY_SAFETY_MARGIN_MS > Date.now()) {
    return cachedToken.accessToken
  }
  inFlight ??= acquire().finally(() => {
    inFlight = null
  })
  cachedToken = await inFlight
  return cachedToken.accessToken
}

export function clearAzureCliAccessTokenCache(): void {
  cachedToken = null
}

const managedTokens = new Map<string, CachedToken>()
const managedInFlight = new Map<string, Promise<CachedToken>>()

async function acquireForConfigDir(configDir: string): Promise<CachedToken> {
  const raw = await runAzureCliJson(
    ['account', 'get-access-token', '--resource', AZURE_DEVOPS_ENTRA_RESOURCE_ID],
    { configDir }
  )
  const token = parseAzureCliAccessToken(raw, Date.now())
  if (!token) {
    throw new Error('Azure CLI returned no access token')
  }
  return token
}

/**
 * Token for a Dolphin-managed account, read from its isolated Azure CLI config dir.
 * Why no notice/refresh timer: those track the user's own az session, not these.
 */
export async function getAzureCliAccessTokenForConfigDir(configDir: string): Promise<string> {
  const cached = managedTokens.get(configDir)
  if (cached && cached.expiresAtMs - EXPIRY_SAFETY_MARGIN_MS > Date.now()) {
    return cached.accessToken
  }
  let pending = managedInFlight.get(configDir)
  if (!pending) {
    pending = acquireForConfigDir(configDir).finally(() => managedInFlight.delete(configDir))
    managedInFlight.set(configDir, pending)
  }
  const token = await pending
  managedTokens.set(configDir, token)
  return token.accessToken
}

/** Drops one managed account's cached token, or all of them when omitted. */
export function clearManagedAzureCliAccessTokenCache(configDir?: string): void {
  if (configDir === undefined) {
    managedTokens.clear()
    return
  }
  managedTokens.delete(configDir)
}
