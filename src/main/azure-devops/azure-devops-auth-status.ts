import type { AzureDevOpsAuthStatus } from '../../shared/azure-devops-auth'
import {
  normalizeAzureDevOpsApiBaseUrl,
  requestAzureDevOpsJsonAtBase
} from './azure-devops-api-request'
import { azureDevOpsTokenConfigured, getAzureDevOpsAuthConfig } from './azure-devops-env-config'
import { getAzureDevOpsAuthPreference } from './azure-devops-auth-preference-store'
import { getAzureCliAccessToken } from './azure-cli-access-token'
import { getAzureCliStatus } from './azure-cli-status'
import { forgetAzureCliSession, getAzureCliTokenExpiresAt } from './azure-cli-session-store'

export type { AzureDevOpsAuthStatus }

type ConnectionData = {
  authenticatedUser?: {
    providerDisplayName?: string | null
    customDisplayName?: string | null
    uniqueName?: string | null
  } | null
}

function probeConnection(baseUrl: string): Promise<ConnectionData | null> {
  return requestAzureDevOpsJsonAtBase<ConnectionData>(baseUrl, '/_apis/connectionData', {
    timeoutMs: 4000
  })
}

function connectionAccount(connection: ConnectionData | null): string | null {
  const user = connection?.authenticatedUser
  return user?.providerDisplayName ?? user?.customDisplayName ?? user?.uniqueName ?? null
}

async function getTokenAuthStatus(): Promise<AzureDevOpsAuthStatus> {
  const config = getAzureDevOpsAuthConfig()
  const baseUrl = config.apiBaseUrl ? normalizeAzureDevOpsApiBaseUrl(config.apiBaseUrl) : null
  const hasToken = azureDevOpsTokenConfigured(config)
  const base = { authMethod: 'token' as const, baseUrl, tokenConfigured: hasToken }
  if (!baseUrl) {
    return { ...base, configured: hasToken, authenticated: false, account: null }
  }
  const connection = await probeConnection(baseUrl)
  const user = connection?.authenticatedUser
  return {
    ...base,
    configured: hasToken || connection !== null,
    authenticated: connection !== null && (hasToken || user !== null),
    account: connectionAccount(connection)
  }
}

async function canAcquireAzureCliToken(): Promise<boolean> {
  try {
    await getAzureCliAccessToken()
    return true
  } catch {
    return false
  }
}

async function getAzureCliAuthStatus(): Promise<AzureDevOpsAuthStatus> {
  const probed = await getAzureCliStatus()
  if (probed.installed && !probed.authenticated) {
    // No account at all means the user signed out; auto-renew must not undo that.
    forgetAzureCliSession()
  }
  // Why: `az account show` answers from the cached account even when conditional access
  // has expired the refresh token, so only a fresh token proves the sign-in still works.
  const azureCli =
    probed.authenticated && !(await canAcquireAzureCliToken())
      ? { ...probed, authenticated: false }
      : probed
  const configuredBaseUrl = getAzureDevOpsAuthConfig().apiBaseUrl
  const baseUrl = configuredBaseUrl
    ? normalizeAzureDevOpsApiBaseUrl(configuredBaseUrl)
    : azureCli.defaultOrganization
      ? normalizeAzureDevOpsApiBaseUrl(azureCli.defaultOrganization)
      : null
  const base = {
    authMethod: 'azure-cli' as const,
    azureCli: { ...azureCli, tokenExpiresAt: getAzureCliTokenExpiresAt() },
    autoRenewCliSession: getAzureDevOpsAuthPreference().autoRenewCliSession,
    baseUrl,
    tokenConfigured: false
  }
  if (!azureCli.authenticated) {
    return { ...base, configured: azureCli.installed, authenticated: false, account: null }
  }
  // Without an organization there is nothing to probe; the fresh token is the proof.
  if (!baseUrl) {
    return { ...base, configured: true, authenticated: true, account: azureCli.account }
  }
  const connection = await probeConnection(baseUrl)
  return {
    ...base,
    configured: true,
    authenticated: connection !== null,
    account: connectionAccount(connection) ?? azureCli.account
  }
}

export function getAzureDevOpsAuthStatus(): Promise<AzureDevOpsAuthStatus> {
  return getAzureDevOpsAuthPreference().method === 'azure-cli'
    ? getAzureCliAuthStatus()
    : getTokenAuthStatus()
}
