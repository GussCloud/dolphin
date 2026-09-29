import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  listAzureDevOpsRepositories,
  mapAzureDevOpsRepositories,
  searchAzureDevOpsBranches
} from './repositories-client'
import { _resetAzureDevOpsPreviewApiVersionCache } from './azure-devops-api-request'
import type { AzureDevOpsRepoRef } from './repository-ref'

const organizationUrl = vi.hoisted(() => vi.fn())

vi.mock('../azure-boards/azure-boards-scope', () => ({
  getAzureBoardsOrganizationUrl: organizationUrl
}))
vi.mock('./azure-devops-credential', () => ({
  resolveAzureDevOpsAuthHeaders: async () => ({ Authorization: 'Bearer t' })
}))
vi.mock('./azure-devops-auth-preference-store', () => ({
  getAzureDevOpsAuthPreference: () => ({ method: 'azure-cli' })
}))

const repo: AzureDevOpsRepoRef = {
  host: 'dev.azure.com',
  organization: 'acme',
  project: 'Web',
  repository: 'app',
  apiBaseUrl: 'https://dev.azure.com/acme/Web',
  webBaseUrl: 'https://dev.azure.com/acme/Web/_git/app'
}

function stubFetch(body: unknown): URL[] {
  const urls: URL[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request) => {
      urls.push(new URL(String(input)))
      return Response.json(body)
    })
  )
  return urls
}

describe('mapAzureDevOpsRepositories', () => {
  it('sorts by project then name and skips disabled or incomplete entries', () => {
    expect(
      mapAzureDevOpsRepositories({
        value: [
          {
            name: 'web',
            remoteUrl: 'https://x/web',
            project: { name: 'B' },
            defaultBranch: 'refs/heads/main'
          },
          {
            name: 'api',
            remoteUrl: 'https://x/api',
            project: { name: 'A' },
            sshUrl: 'git@ssh:v3/a'
          },
          { name: 'old', remoteUrl: 'https://x/old', project: { name: 'A' }, isDisabled: true },
          { name: 'broken', project: { name: 'A' } }
        ]
      }).map((entry) => [entry.project, entry.name, entry.defaultBranch])
    ).toEqual([
      ['A', 'api', null],
      ['B', 'web', 'main']
    ])
  })
})

describe('Azure DevOps repository and branch lookups', () => {
  beforeEach(() => {
    _resetAzureDevOpsPreviewApiVersionCache()
    organizationUrl.mockResolvedValue('https://dev.azure.com/acme')
  })
  afterEach(() => vi.unstubAllGlobals())

  it('lists organization-wide repositories from the host-owned organization', async () => {
    const urls = stubFetch({ value: [] })
    await listAzureDevOpsRepositories()
    expect(urls[0]?.href).toContain('https://dev.azure.com/acme/_apis/git/repositories')
  })

  it('refuses to list without an organization', async () => {
    organizationUrl.mockResolvedValue(null)
    const urls = stubFetch({ value: [] })
    await expect(listAzureDevOpsRepositories()).rejects.toThrow('default Azure DevOps organization')
    expect(urls).toHaveLength(0)
  })

  it('searches branch heads and strips the refs prefix', async () => {
    const urls = stubFetch({
      value: [
        { name: 'refs/heads/release/1.0' },
        { name: 'refs/tags/v1' },
        { name: 'refs/heads/main' }
      ]
    })
    await expect(searchAzureDevOpsBranches(repo, ' rel ')).resolves.toEqual(['release/1.0', 'main'])
    expect(urls[0]?.pathname).toBe('/acme/Web/_apis/git/repositories/app/refs')
    expect(urls[0]?.searchParams.get('filter')).toBe('heads/')
    expect(urls[0]?.searchParams.get('filterContains')).toBe('rel')
  })
})
