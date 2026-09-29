import type { AzureDevOpsRepository } from '../../shared/azure-devops-auth'
import { getAzureBoardsOrganizationUrl } from '../azure-boards/azure-boards-scope'
import { resolveAzureDevOpsGitApiBaseUrl } from './azure-devops-api-request'
import { sendAzureDevOpsRequest } from './azure-devops-mutation-request'
import type { AzureDevOpsRepoRef } from './repository-ref'

const BRANCH_SEARCH_LIMIT = 20

function listOf(payload: unknown): unknown[] {
  return payload &&
    typeof payload === 'object' &&
    'value' in payload &&
    Array.isArray(payload.value)
    ? payload.value
    : []
}

function stringField(record: object, key: string): string | null {
  const value: unknown = Object.getOwnPropertyDescriptor(record, key)?.value
  return typeof value === 'string' && value ? value : null
}

export function mapAzureDevOpsRepositories(payload: unknown): AzureDevOpsRepository[] {
  return listOf(payload)
    .flatMap((raw): AzureDevOpsRepository[] => {
      if (!raw || typeof raw !== 'object') {
        return []
      }
      const name = stringField(raw, 'name')
      const remoteUrl = stringField(raw, 'remoteUrl')
      const project =
        'project' in raw && raw.project && typeof raw.project === 'object'
          ? stringField(raw.project, 'name')
          : null
      // Disabled repositories cannot be cloned.
      if (!name || !remoteUrl || !project || ('isDisabled' in raw && raw.isDisabled === true)) {
        return []
      }
      return [
        {
          name,
          project,
          remoteUrl,
          sshUrl: stringField(raw, 'sshUrl'),
          webUrl: stringField(raw, 'webUrl'),
          defaultBranch: stringField(raw, 'defaultBranch')?.replace(/^refs\/heads\//, '') ?? null
        }
      ]
    })
    .sort(
      (left, right) =>
        left.project.localeCompare(right.project) || left.name.localeCompare(right.name)
    )
}

/** Every repository in the host's organization, across projects. */
export async function listAzureDevOpsRepositories(): Promise<AzureDevOpsRepository[]> {
  const organizationUrl = await getAzureBoardsOrganizationUrl()
  if (!organizationUrl) {
    throw new Error(
      'Set a default Azure DevOps organization in Settings > Integrations to browse repositories.'
    )
  }
  return mapAzureDevOpsRepositories(
    await sendAzureDevOpsRequest(organizationUrl, '/_apis/git/repositories', { method: 'GET' })
  )
}

/** Branch names on the Azure DevOps remote whose name contains `query`. */
export async function searchAzureDevOpsBranches(
  repo: AzureDevOpsRepoRef,
  query: string
): Promise<string[]> {
  const payload = await sendAzureDevOpsRequest(
    resolveAzureDevOpsGitApiBaseUrl(repo),
    `/_apis/git/repositories/${encodeURIComponent(repo.repository)}/refs`,
    {
      method: 'GET',
      searchParams: {
        filter: 'heads/',
        ...(query.trim() ? { filterContains: query.trim() } : {}),
        $top: BRANCH_SEARCH_LIMIT
      }
    }
  )
  return listOf(payload).flatMap((ref) => {
    const name = ref && typeof ref === 'object' ? stringField(ref, 'name') : null
    return name?.startsWith('refs/heads/') ? [name.slice('refs/heads/'.length)] : []
  })
}
