import { z } from 'zod'
import type { AzureDevOpsRepository } from '../../shared/azure-devops-auth'
import { getAzureBoardsOrganizationUrl } from '../azure-boards/azure-boards-scope'
import { resolveAzureDevOpsGitApiBaseUrl } from './azure-devops-api-request'
import { sendAzureDevOpsRequest } from './azure-devops-mutation-request'
import type { AzureDevOpsRepoRef } from './repository-ref'

const BRANCH_SEARCH_LIMIT = 20

const NonEmpty = z.string().min(1)

const RawRepository = z.object({
  name: NonEmpty,
  remoteUrl: NonEmpty,
  project: z.object({ name: NonEmpty }),
  sshUrl: z.string().nullish(),
  webUrl: z.string().nullish(),
  defaultBranch: z.string().nullish(),
  isDisabled: z.boolean().nullish()
})

const RawRef = z.object({ name: NonEmpty })

// Azure DevOps list responses wrap items in `value`; unparseable items are dropped one by one.
function parseList<T>(payload: unknown, item: z.ZodType<T>): T[] {
  const list = z.object({ value: z.array(z.unknown()) }).safeParse(payload)
  if (!list.success) {
    return []
  }
  return list.data.value.flatMap((raw) => {
    const parsed = item.safeParse(raw)
    return parsed.success ? [parsed.data] : []
  })
}

export function mapAzureDevOpsRepositories(payload: unknown): AzureDevOpsRepository[] {
  return parseList(payload, RawRepository)
    .filter((raw) => raw.isDisabled !== true)
    .map((raw) => ({
      name: raw.name,
      project: raw.project.name,
      remoteUrl: raw.remoteUrl,
      sshUrl: raw.sshUrl || null,
      webUrl: raw.webUrl || null,
      defaultBranch: raw.defaultBranch?.replace(/^refs\/heads\//, '') || null
    }))
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
  return parseList(payload, RawRef).flatMap(({ name }) =>
    name.startsWith('refs/heads/') ? [name.slice('refs/heads/'.length)] : []
  )
}
