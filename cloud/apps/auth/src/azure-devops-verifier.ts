import { z } from 'zod'

export type AzureDevOpsOrganizationRef = { organizationName: string; baseUrl: string }
export type AzureDevOpsTokenKind = 'bearer' | 'pat'
export type AzureDevOpsFetch = (url: string, init: RequestInit) => Promise<Response>

export type AzureDevOpsProof =
  | { status: 'verified'; instanceId: string; azureDevOpsUserId: string }
  | { status: 'invalid-credentials' }
  | { status: 'not-admin' }
  | { status: 'unavailable' }

const REQUEST_TIMEOUT_MS = 5000
// Org names are letters, digits and hyphens; anything else never reaches fetch.
const ORGANIZATION_NAME = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/
const VISUALSTUDIO_SUFFIX = '.visualstudio.com'
// https://learn.microsoft.com/en-us/azure/devops/organizations/security/namespace-reference (Collection namespace)
const COLLECTION_NAMESPACE_ID = '3e65f728-f8bc-4ecd-8764-7e378b19bfa7'
const COLLECTION_GENERIC_WRITE = 2

// Only real people (Entra/MSA) may join; public orgs answer anyone else as
// `System:PublicAccess;aaaaaaaa-…` ("Anonymous") with 200, even for a bogus token (seen on dev.azure.com/dnceng-public).
// Shape: https://learn.microsoft.com/en-us/javascript/api/azure-devops-extension-api/connectiondata
const PERSON_DESCRIPTOR_TYPE = 'Microsoft.IdentityModel.Claims.ClaimsIdentity;'

const ConnectionIdentity = z.object({ id: z.string().uuid(), descriptor: z.string() })
const ConnectionData = z.object({
  instanceId: z.string().uuid(),
  authenticatedUser: ConnectionIdentity,
  authorizedUser: ConnectionIdentity.optional()
})

function isMemberIdentity(data: z.infer<typeof ConnectionData>): boolean {
  const user = data.authenticatedUser
  // A differing authorized identity means the request ran as someone else (or as public access).
  const sameIdentity = !data.authorizedUser || data.authorizedUser.id.toLowerCase() === user.id.toLowerCase()
  return sameIdentity && user.descriptor.startsWith(PERSON_DESCRIPTOR_TYPE)
}
const PermissionResults = z.object({ value: z.array(z.boolean()) })

/** SSRF guard: only the two public Azure DevOps URL forms, rebuilt from the org name alone. */
export function parseAzureDevOpsOrganizationUrl(raw: string): AzureDevOpsOrganizationRef | null {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    return null
  }
  const host = url.hostname
  const name =
    host === 'dev.azure.com'
      ? url.pathname.split('/').find(Boolean)?.toLowerCase()
      : host.endsWith(VISUALSTUDIO_SUFFIX)
        ? host.slice(0, -VISUALSTUDIO_SUFFIX.length)
        : undefined
  if (!name || !ORGANIZATION_NAME.test(name)) {
    return null
  }
  return {
    organizationName: name,
    baseUrl: host === 'dev.azure.com' ? `https://dev.azure.com/${name}` : `https://${name}${VISUALSTUDIO_SUFFIX}`
  }
}

function authorizationHeader(token: string, kind: AzureDevOpsTokenKind): string {
  return kind === 'bearer' ? `Bearer ${token}` : `Basic ${Buffer.from(`:${token}`).toString('base64')}`
}

type JsonOutcome = { status: 'json'; body: unknown } | { status: 'invalid-credentials' } | { status: 'unavailable' }

export function createAzureDevOpsVerifier(fetchImpl: AzureDevOpsFetch = fetch) {
  async function getJson(url: string, token: string, kind: AzureDevOpsTokenKind): Promise<JsonOutcome> {
    let res: Response
    try {
      res = await fetchImpl(url, {
        headers: { authorization: authorizationHeader(token, kind), accept: 'application/json' },
        // Why manual, not error: a sign-in redirect must read as bad credentials, not as an outage.
        redirect: 'manual',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      })
    } catch {
      return { status: 'unavailable' }
    }
    const signInPage = res.status === 203 || (res.status >= 300 && res.status < 400)
    if (signInPage || res.status === 401 || res.status === 403 || res.status === 404) {
      await res.body?.cancel()
      return { status: 'invalid-credentials' }
    }
    if (!res.ok) {
      await res.body?.cancel()
      return { status: 'unavailable' }
    }
    if (!(res.headers.get('content-type') ?? '').includes('json')) {
      await res.body?.cancel()
      return { status: 'invalid-credentials' }
    }
    try {
      return { status: 'json', body: await res.json() }
    } catch {
      return { status: 'invalid-credentials' }
    }
  }

  /** Proves the token belongs to a member of the org; the server reads instanceId itself. */
  async function verifyMember(
    org: AzureDevOpsOrganizationRef,
    token: string,
    kind: AzureDevOpsTokenKind
  ): Promise<AzureDevOpsProof> {
    const outcome = await getJson(`${org.baseUrl}/_apis/connectionData`, token, kind)
    if (outcome.status !== 'json') {
      return outcome
    }
    const parsed = ConnectionData.safeParse(outcome.body)
    if (!parsed.success || !isMemberIdentity(parsed.data)) {
      return { status: 'invalid-credentials' }
    }
    return {
      status: 'verified',
      instanceId: parsed.data.instanceId.toLowerCase(),
      azureDevOpsUserId: parsed.data.authenticatedUser.id.toLowerCase()
    }
  }

  /** Member proof plus "Edit instance-level information", which Project Collection Administrators hold. */
  async function verifyAdministrator(
    org: AzureDevOpsOrganizationRef,
    token: string,
    kind: AzureDevOpsTokenKind
  ): Promise<AzureDevOpsProof> {
    const member = await verifyMember(org, token, kind)
    if (member.status !== 'verified') {
      return member
    }
    // https://learn.microsoft.com/en-us/rest/api/azure/devops/security/permissions/has-permissions?view=azure-devops-rest-7.1
    const url =
      `${org.baseUrl}/_apis/permissions/${COLLECTION_NAMESPACE_ID}/${COLLECTION_GENERIC_WRITE}` +
      '?tokens=NAMESPACE&alwaysAllowAdministrators=false&api-version=7.1'
    const outcome = await getJson(url, token, kind)
    if (outcome.status === 'unavailable') {
      return outcome
    }
    // A token scoped too narrowly to read permissions cannot prove admin either.
    const parsed = outcome.status === 'json' ? PermissionResults.safeParse(outcome.body) : undefined
    return parsed?.success && parsed.data.value[0] === true ? member : { status: 'not-admin' }
  }

  return { verifyMember, verifyAdministrator }
}

export type AzureDevOpsVerifier = ReturnType<typeof createAzureDevOpsVerifier>
