import type { AzureDevOpsFetch } from '../azure-devops-verifier.js'

export const OUTAGE_TOKEN = 'fake-token-outage'
export const SIGN_IN_REDIRECT_TOKEN = 'fake-token-sign-in-redirect'

export type FakeAzureDevOpsOrg = {
  name: string
  instanceId: string
  /** Token → AzDO user; tokens are obviously fake so secret scanners stay quiet. */
  members: Map<string, { id: string; admin: boolean }>
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
    const member = org?.members.get(token)
    if (!org || !member) {
      return new Response('unauthorized', { status: 401 })
    }
    if (path === '/_apis/connectionData') {
      return Response.json({ instanceId: org.instanceId, authenticatedUser: { id: member.id } })
    }
    if (path === PERMISSIONS_PATH && parsed.searchParams.get('tokens') === 'NAMESPACE') {
      return Response.json({ count: 1, value: [member.admin] })
    }
    return new Response('not found', { status: 404 })
  }
  return { fetch: fetchImpl, calls }
}
