import type { AzureDevOpsFetch } from '../azure-devops-verifier.js'

export const OUTAGE_TOKEN = 'fake-token-outage'
export const SIGN_IN_REDIRECT_TOKEN = 'fake-token-sign-in-redirect'

export type FakeAzureDevOpsIdentity = { id: string; descriptor: string }

export type FakeAzureDevOpsOrg = {
  name: string
  instanceId: string
  /** Token → AzDO user; tokens are obviously fake so secret scanners stay quiet. */
  members: Map<
    string,
    {
      id: string
      admin: boolean
      descriptor?: string
      authorizedAs?: FakeAzureDevOpsIdentity
      /** false: a signed-in outsider (or a PAT without vso.project) whose org-level calls are refused. */
      orgMember?: boolean
      /** Emitted as `properties.Account.$value`, the shape dev.azure.com returns. */
      account?: string
      providerDisplayName?: string
    }
  >
  /** Public projects: unknown callers get 200 as the public-access identity instead of 401. */
  publicProjects?: boolean
}

// Captured from dev.azure.com/dnceng-public/_apis/connectionData with no or a bogus token.
const PUBLIC_ACCESS_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
export const PUBLIC_ACCESS_IDENTITY = {
  id: PUBLIC_ACCESS_ID,
  descriptor: `System:PublicAccess;${PUBLIC_ACCESS_ID}`,
  providerDisplayName: 'Anonymous'
}

const PERMISSIONS_PATH = '/_apis/permissions/3e65f728-f8bc-4ecd-8764-7e378b19bfa7/2'

function tokenFrom(header: string): string {
  if (header.startsWith('Bearer ')) {
    return header.slice(7)
  }
  if (header.startsWith('Basic ')) {
    return Buffer.from(header.slice(6), 'base64').toString('utf8').replace(/^:/, '')
  }
  return ''
}

/** In-memory Azure DevOps answering connectionData and the Collection permission check. */
export function fakeAzureDevOps(orgs: FakeAzureDevOpsOrg[]) {
  const calls: { url: string; authorization: string }[] = []
  const fetchImpl: AzureDevOpsFetch = async (url, init) => {
    const authorization = new Headers(init.headers).get('authorization') ?? ''
    calls.push({ url, authorization })
    const parsed = new URL(url)
    const devAzure = parsed.hostname === 'dev.azure.com'
    const segments = parsed.pathname.split('/')
    const name = devAzure ? segments[1] : parsed.hostname.split('.')[0]
    const path = devAzure ? `/${segments.slice(2).join('/')}` : parsed.pathname
    const token = tokenFrom(authorization)
    if (token === OUTAGE_TOKEN) {
      return new Response('unavailable', { status: 503 })
    }
    if (token === SIGN_IN_REDIRECT_TOKEN) {
      return new Response(null, { status: 302, headers: { location: 'https://login.example/sign-in' } })
    }
    const org = orgs.find((candidate) => candidate.name === name)
    if (!authorization) {
      return org?.publicProjects && path === '/_apis/connectionData'
        ? Response.json({ instanceId: org.instanceId, authenticatedUser: PUBLIC_ACCESS_IDENTITY })
        : new Response(null, { status: 302, headers: { location: 'https://login.example/sign-in' } })
    }
    const member = org?.members.get(token)
    if (org?.publicProjects && !member && path === '/_apis/connectionData') {
      return Response.json({
        instanceId: org.instanceId,
        authenticatedUser: PUBLIC_ACCESS_IDENTITY,
        authorizedUser: PUBLIC_ACCESS_IDENTITY
      })
    }
    if (!org || !member) {
      return new Response('unauthorized', { status: 401 })
    }
    if (path === '/_apis/connectionData') {
      const user = {
        id: member.id,
        descriptor: member.descriptor ?? `Microsoft.IdentityModel.Claims.ClaimsIdentity;fake-tenant\\${member.id}@example.com`,
        ...(member.providerDisplayName ? { providerDisplayName: member.providerDisplayName } : {}),
        ...(member.account ? { properties: { Account: { $type: 'System.String', $value: member.account } } } : {})
      }
      return Response.json({ instanceId: org.instanceId, authenticatedUser: user, authorizedUser: member.authorizedAs ?? user })
    }
    if (path === '/_apis/projects' && parsed.searchParams.get('$top') === '1') {
      return member.orgMember === false
        ? new Response('unauthorized', { status: 401 })
        : Response.json({ count: 0, value: [] })
    }
    if (path === PERMISSIONS_PATH && parsed.searchParams.get('tokens') === 'NAMESPACE') {
      return Response.json({ count: 1, value: [member.admin] })
    }
    return new Response('not found', { status: 404 })
  }
  return { fetch: fetchImpl, calls }
}
