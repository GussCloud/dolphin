import type { AzureBoardsScopeInfo } from '../../shared/azure-boards-types'
import { normalizeAzureDevOpsApiBaseUrl } from '../azure-devops/azure-devops-api-request'
import { getAzureDevOpsAuthPreference } from '../azure-devops/azure-devops-auth-preference-store'
import { getAzureDevOpsAuthConfig } from '../azure-devops/azure-devops-env-config'
import { sendAzureDevOpsRequest } from '../azure-devops/azure-devops-mutation-request'
import { getAzureCliStatus } from '../azure-devops/azure-cli-status'

async function defaultOrganizationAndProject(): Promise<{
  organizationUrl: string | null
  project: string | null
}> {
  const envBase = getAzureDevOpsAuthConfig().apiBaseUrl
  if (getAzureDevOpsAuthPreference().method === 'azure-cli') {
    const cli = await getAzureCliStatus()
    return {
      organizationUrl: cli.defaultOrganization ?? envBase,
      project: cli.defaultProject
    }
  }
  return { organizationUrl: envBase, project: null }
}

export function readProjectNames(payload: unknown): string[] {
  const list =
    payload && typeof payload === 'object' && 'value' in payload && Array.isArray(payload.value)
      ? payload.value
      : []
  return list
    .flatMap((project: unknown) =>
      project &&
      typeof project === 'object' &&
      'name' in project &&
      typeof project.name === 'string'
        ? [project.name]
        : []
    )
    .sort((left: string, right: string) => left.localeCompare(right))
}

const ORGANIZATION_CACHE_MS = 60_000
let organizationCache: { value: string | null; expiresAt: number } | null = null

/** The organization this host serves; the only origin Azure Boards requests may reach. */
export async function getAzureBoardsOrganizationUrl(): Promise<string | null> {
  if (organizationCache && organizationCache.expiresAt > Date.now()) {
    return organizationCache.value
  }
  const { organizationUrl } = await defaultOrganizationAndProject()
  const value = organizationUrl ? normalizeAzureDevOpsApiBaseUrl(organizationUrl) : null
  organizationCache = { value, expiresAt: Date.now() + ORGANIZATION_CACHE_MS }
  return value
}

export function clearAzureBoardsOrganizationCache(): void {
  organizationCache = null
}

/** Organization and project Azure Boards should use on this host, plus the projects to pick from. */
export async function getAzureBoardsScopeInfo(): Promise<AzureBoardsScopeInfo> {
  clearAzureBoardsOrganizationCache()
  const defaults = await defaultOrganizationAndProject()
  if (!defaults.organizationUrl) {
    return { organizationUrl: null, defaultProject: null, projects: [] }
  }
  const organizationUrl = normalizeAzureDevOpsApiBaseUrl(defaults.organizationUrl)
  const projects = readProjectNames(
    await sendAzureDevOpsRequest(organizationUrl, '/_apis/projects', {
      method: 'GET',
      searchParams: { $top: 500 }
    })
  )
  const defaultProject =
    defaults.project && projects.includes(defaults.project)
      ? defaults.project
      : (projects[0] ?? null)
  return { organizationUrl, defaultProject, projects }
}
