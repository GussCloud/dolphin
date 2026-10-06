import { z } from 'zod'

export type AzureDevOpsOrganizationRef = { organizationName: string; baseUrl: string }
export type AzureDevOpsTokenKind = 'bearer' | 'pat'
export type AzureDevOpsFetch = (url: string, init: RequestInit) => Promise<Response>

export type AzureDevOpsProof =
  | {
      status: 'verified'
      instanceId: string
      azureDevOpsUserId: string
      /** Lowercased; null when the identity exposes no email (never guessed). */
      email: string | null
      displayName: string | null
    }
  | { status: 'invalid-credentials'; reason?: 'public-org-scope' }
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
  // passthrough keeps the profile fields that identityProfile reads leniently.
  authenticatedUser: ConnectionIdentity.passthrough(),
  authorizedUser: ConnectionIdentity.optional()
})

// Live dev.azure.com answers carry `properties.Account.$value` (the sign-in email/UPN); some put
// the email in providerDisplayName instead.
const IdentityProfile = z.object({
  providerDisplayName: z.string().optional(),
  customDisplayName: z.string().optional(),
  properties: z.object({ Account: z.object({ $value: z.string() }).optional() }).optional()
})
const Email = z.string().trim().toLowerCase().email().max(254)
const DISPLAY_NAME_MAX = 100

function identityProfile(user: unknown): { email: string | null; displayName: string | null } {
  const profile = IdentityProfile.safeParse(user)
  if (!profile.success) {
    return { email: null, displayName: null }
  }
  const { providerDisplayName, customDisplayName, properties } = profile.data
  const email = [properties?.Account?.$value, providerDisplayName]
    .map((candidate) => Email.safeParse(candidate))
    .find((parsed) => parsed.success)?.data
  const displayName = (customDisplayName ?? providerDisplayName)?.trim().slice(0, DISPLAY_NAME_MAX)
  return { email: email ?? null, displayName: displayName || null }
}

function isMemberIdentity(data: z.infer<typeof ConnectionData>): boolean {
  const user = data.authenticatedUser
  // A differing authorized identity means the request ran as someone else (or as public access).
  const sameIdentity = !data.authorizedUser || data.authorizedUser.id.toLowerCase() === user.id.toLowerCase()
  return sameIdentity && user.descriptor.startsWith(PERSON_DESCRIPTOR_TYPE)
}
const PermissionResults = z.object({ value: z.array(z.boolean()) })
// Signed-in non-members of a public org may get their own identity back from connectionData, but
// "Azure DevOps rejects any REST API calls that aren't scoped to a project" for them:
// https://learn.microsoft.com/en-us/azure/devops/extend/develop/public-project
const MEMBER_PROBE_PATH = '/_apis/projects?$top=1&api-version=7.1'

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
  /** `credentials: null` calls anonymously. */
  async function getJson(
    url: string,
    credentials: { token: string; kind: AzureDevOpsTokenKind } | null
  ): Promise<JsonOutcome> {
    let res: Response
    try {
      res = await fetchImpl(url, {
        headers: {
          accept: 'application/json',
          ...(credentials ? { authorization: authorizationHeader(credentials.token, credentials.kind) } : {})
        },
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
    const connectionData = `${org.baseUrl}/_apis/connectionData`
    // Only orgs with public projects answer anonymously; private orgs skip the member probe.
    const [outcome, anonymous] = await Promise.all([
      getJson(connectionData, { token, kind }),
      getJson(connectionData, null)
    ])
    if (outcome.status !== 'json') {
      return outcome
    }
    const parsed = ConnectionData.safeParse(outcome.body)
    if (!parsed.success || !isMemberIdentity(parsed.data)) {
      return { status: 'invalid-credentials' }
    }
    if (anonymous.status === 'unavailable') {
      return anonymous
    }
    if (anonymous.status === 'json') {
      const probe = await getJson(`${org.baseUrl}${MEMBER_PROBE_PATH}`, { token, kind })
      if (probe.status === 'unavailable') {
        return probe
      }
      if (probe.status !== 'json') {
        // A non-member and a member whose PAT lacks vso.project look the same here.
        return { status: 'invalid-credentials', reason: 'public-org-scope' }
      }
    }
    return {
      status: 'verified',
      instanceId: parsed.data.instanceId.toLowerCase(),
      azureDevOpsUserId: parsed.data.authenticatedUser.id.toLowerCase(),
      ...identityProfile(parsed.data.authenticatedUser)
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
    const outcome = await getJson(url, { token, kind })
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
