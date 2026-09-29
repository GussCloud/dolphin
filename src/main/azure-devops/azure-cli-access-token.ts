import { AZURE_DEVOPS_ENTRA_RESOURCE_ID } from '../../shared/azure-devops-auth'
import { runAzureCliJson } from './azure-cli-runner'

// Refresh this long before expiry so an in-flight request never carries a dead token.
const EXPIRY_SAFETY_MARGIN_MS = 5 * 60_000

type CachedToken = { accessToken: string; expiresAtMs: number }

let cachedToken: CachedToken | null = null
let inFlight: Promise<CachedToken> | null = null

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

async function acquire(): Promise<CachedToken> {
  const raw = await runAzureCliJson([
    'account',
    'get-access-token',
    '--resource',
    AZURE_DEVOPS_ENTRA_RESOURCE_ID
  ])
  const token = parseAzureCliAccessToken(raw, Date.now())
  if (!token) {
    throw new Error('Azure CLI returned no access token')
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
