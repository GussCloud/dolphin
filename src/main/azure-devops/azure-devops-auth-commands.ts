import {
  isAzureDevOpsAuthMethod,
  normalizeAzureDevOpsOrganizationUrl,
  type AzureDevOpsAuthPreference,
  type AzureDevOpsRepositoriesResult,
  type AzureDevOpsConfigureDefaultsResult
} from '../../shared/azure-devops-auth'
import { _resetPreflightCache } from '../preflight/agent-detection'
import { clearAzureCliAccessTokenCache } from './azure-cli-access-token'
import { configureAzureDevOpsDefaults } from './azure-cli-status'
import { listAzureDevOpsRepositories } from './repositories-client'
import { clearAzureBoardsOrganizationCache } from '../azure-boards/azure-boards-scope'
import { setAzureDevOpsAuthPreference } from './azure-devops-auth-preference-store'

// Shared by the desktop IPC handlers and the runtime RPC methods so both hosts apply
// the same validation and cache invalidation.

export function changeAzureDevOpsAuthMethod(method: unknown): AzureDevOpsAuthPreference {
  if (!isAzureDevOpsAuthMethod(method)) {
    throw new Error('Invalid Azure DevOps auth method')
  }
  const preference = setAzureDevOpsAuthPreference({ method })
  clearAzureCliAccessTokenCache()
  clearAzureBoardsOrganizationCache()
  // Preflight caches the integration status per session; the card must reflect the switch.
  _resetPreflightCache()
  return preference
}

export async function setAzureDevOpsCliDefaults(input: {
  organization: string
  project?: string | null
}): Promise<AzureDevOpsConfigureDefaultsResult> {
  const organization = normalizeAzureDevOpsOrganizationUrl(input.organization)
  if (!organization) {
    return { ok: false, error: 'Enter an Azure DevOps organization name or URL.' }
  }
  const project = input.project?.trim() || null
  const result = await configureAzureDevOpsDefaults({ organization, project })
  if (result.ok) {
    clearAzureBoardsOrganizationCache()
    _resetPreflightCache()
  }
  return result
}

export async function listAzureDevOpsRepositoriesResult(): Promise<AzureDevOpsRepositoriesResult> {
  try {
    return { ok: true, repositories: await listAzureDevOpsRepositories() }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export function refreshAzureCliSession(): void {
  clearAzureCliAccessTokenCache()
  clearAzureBoardsOrganizationCache()
  _resetPreflightCache()
}
