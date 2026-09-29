import { Buffer } from 'node:buffer'
import { azureDevOpsTokenConfigured, getAzureDevOpsAuthConfig } from './azure-devops-env-config'
import { getAzureCliAccessToken } from './azure-cli-access-token'
import { getAzureDevOpsAuthPreference } from './azure-devops-auth-preference-store'

/** Authorization headers for the host's chosen credential source; empty when none is usable. */
export async function resolveAzureDevOpsAuthHeaders(): Promise<Record<string, string>> {
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

export async function hasAzureDevOpsCredential(): Promise<boolean> {
  if (getAzureDevOpsAuthPreference().method === 'token') {
    return azureDevOpsTokenConfigured(getAzureDevOpsAuthConfig())
  }
  return Object.keys(await resolveAzureDevOpsAuthHeaders()).length > 0
}
