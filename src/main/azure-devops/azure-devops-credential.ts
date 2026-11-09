import { Buffer } from 'node:buffer'
import { azureDevOpsTokenConfigured, getAzureDevOpsAuthConfig } from './azure-devops-env-config'
import { getAzureCliAccessToken } from './azure-cli-access-token'
import { getAzureDevOpsAuthPreference } from './azure-devops-auth-preference-store'
import {
  resolveAzureDevOpsAccountToken,
  type AzureDevOpsCredentialScope
} from './azure-devops-account-scope'

/**
 * Authorization headers for a request. With a project `scope`, only that account is used and
 * an unusable one throws; without it, the host's chosen credential source (empty when none).
 */
export async function resolveAzureDevOpsAuthHeaders(
  scope?: AzureDevOpsCredentialScope
): Promise<Record<string, string>> {
  if (scope) {
    return { Authorization: `Bearer ${await resolveAzureDevOpsAccountToken(scope.accountId)}` }
  }
  if (getAzureDevOpsAuthPreference().method === 'azure-cli') {
    try {
      return { Authorization: `Bearer ${await getAzureCliAccessToken()}` }
    } catch {
      return {}
    }
  }
  const config = getAzureDevOpsAuthConfig()
  if (config.accessToken) {
    return { Authorization: `Bearer ${config.accessToken}` }
  }
  if (config.pat) {
    const encoded = Buffer.from(`${config.username ?? ''}:${config.pat}`).toString('base64')
    return { Authorization: `Basic ${encoded}` }
  }
  return {}
}

export function azureDevOpsAuthInstruction(): string {
  return getAzureDevOpsAuthPreference().method === 'azure-cli'
    ? 'sign in with the Azure CLI in Settings > Integrations'
    : 'set DOLPHIN_AZURE_DEVOPS_TOKEN in this environment'
}

export async function hasAzureDevOpsCredential(
  scope?: AzureDevOpsCredentialScope
): Promise<boolean> {
  if (scope) {
    try {
      await resolveAzureDevOpsAccountToken(scope.accountId)
      return true
    } catch {
      return false
    }
  }
  if (getAzureDevOpsAuthPreference().method === 'token') {
    return azureDevOpsTokenConfigured(getAzureDevOpsAuthConfig())
  }
  return Object.keys(await resolveAzureDevOpsAuthHeaders()).length > 0
}
