import { sendAzureDevOpsRequest } from './azure-devops-mutation-request'
import { azureDevOpsCollectionBaseUrl } from './pull-request-details'
import type { AzureDevOpsRepoRef } from './repository-ref'

type IdentityMatch = {
  id: string
  displayName: string
  mail: string | null
  account: string | null
}

/** Identities live on the vssps host for Azure DevOps Services and on the collection for Server. */
export function azureDevOpsIdentityBaseUrl(repo: AzureDevOpsRepoRef): string {
  if (repo.host === 'dev.azure.com' && repo.organization) {
    return `https://vssps.dev.azure.com/${encodeURIComponent(repo.organization)}`
  }
  if (repo.host.endsWith('.visualstudio.com') && repo.organization) {
    return `https://${repo.organization}.vssps.visualstudio.com`
  }
  return azureDevOpsCollectionBaseUrl(repo)
}

function readProperty(properties: unknown, key: string): string | null {
  if (!properties || typeof properties !== 'object' || !(key in properties)) {
    return null
  }
  const entry: unknown = Object.getOwnPropertyDescriptor(properties, key)?.value
  if (entry && typeof entry === 'object' && '$value' in entry) {
    return typeof entry.$value === 'string' && entry.$value ? entry.$value : null
  }
  return null
}

export function parseIdentityMatches(payload: unknown): IdentityMatch[] {
  const list =
    payload && typeof payload === 'object' && 'value' in payload && Array.isArray(payload.value)
      ? payload.value
      : []
  return list.flatMap((raw: unknown): IdentityMatch[] => {
    if (!raw || typeof raw !== 'object' || !('id' in raw) || typeof raw.id !== 'string') {
      return []
    }
    const properties = 'properties' in raw ? raw.properties : null
    const name =
      'providerDisplayName' in raw && typeof raw.providerDisplayName === 'string'
        ? raw.providerDisplayName
        : raw.id
    return [
      {
        id: raw.id,
        displayName: name,
        mail: readProperty(properties, 'Mail'),
        account: readProperty(properties, 'Account')
      }
    ]
  })
}

/** Resolves an email, account or display name to exactly one identity id, or throws. */
export async function resolveAzureDevOpsIdentityId(
  repo: AzureDevOpsRepoRef,
  query: string
): Promise<string> {
  const trimmed = query.trim()
  if (!trimmed) {
    throw new Error('Enter a reviewer email or name.')
  }
  const payload = await sendAzureDevOpsRequest(
    azureDevOpsIdentityBaseUrl(repo),
    '/_apis/identities',
    {
      method: 'GET',
      searchParams: { searchFilter: 'General', filterValue: trimmed, queryMembership: 'None' }
    }
  )
  const matches = parseIdentityMatches(payload)
  const lower = trimmed.toLowerCase()
  const exact = matches.filter((match) =>
    [match.mail, match.account, match.displayName].some((value) => value?.toLowerCase() === lower)
  )
  const [chosen] = exact.length > 0 ? exact : matches
  if (!chosen) {
    throw new Error(`No Azure DevOps user matches "${trimmed}".`)
  }
  if (exact.length !== 1 && matches.length > 1) {
    throw new Error(`"${trimmed}" matches several users; enter the full email address.`)
  }
  return chosen.id
}
