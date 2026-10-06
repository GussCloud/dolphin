import type {
  DolphinOrgMember,
  DolphinOrgMembersRoster,
  DolphinOrgPendingInvite,
  DolphinOrgRole
} from '../../shared/dolphin-profiles'
import type { DolphinCloudAuthConfig } from './profile-cloud-auth-config'
import type { DolphinCloudSession } from './profile-cloud-session-store'
import { DolphinCloudRequestError } from './profile-cloud-client'

const CLOUD_REQUEST_TIMEOUT_MS = 30_000
const ORG_ROLES: readonly DolphinOrgRole[] = ['owner', 'admin', 'member']

function isOrgRole(value: unknown): value is DolphinOrgRole {
  return typeof value === 'string' && (ORG_ROLES as readonly string[]).includes(value)
}

function normalizeRole(value: unknown, fallback: DolphinOrgRole): DolphinOrgRole {
  return isOrgRole(value) ? value : fallback
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed || undefined
}

function normalizeTimestamp(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return Date.now()
}

function normalizeMember(value: unknown): DolphinOrgMember | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const record = value as Record<string, unknown>
  const email = optionalString(record.email)
  if (!email) {
    return null
  }
  const userId = optionalString(record.userId)
  return {
    userId: userId ?? null,
    email,
    displayName: optionalString(record.displayName),
    role: normalizeRole(record.role, 'member')
  }
}

function normalizePendingInvite(value: unknown): DolphinOrgPendingInvite | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const record = value as Record<string, unknown>
  const email = optionalString(record.email)
  if (!email) {
    return null
  }
  return {
    email,
    role: normalizeRole(record.role, 'member'),
    createdAt: normalizeTimestamp(record.createdAt)
  }
}

function normalizeRoster(value: unknown): DolphinOrgMembersRoster {
  if (!value || typeof value !== 'object') {
    throw new Error('invalid_dolphin_org_members_roster')
  }
  const record = value as Record<string, unknown>
  const members = Array.isArray(record.members)
    ? record.members
        .map(normalizeMember)
        .filter((member): member is DolphinOrgMember => member !== null)
    : []
  const pendingInvites = Array.isArray(record.pendingInvites)
    ? record.pendingInvites
        .map(normalizePendingInvite)
        .filter((invite): invite is DolphinOrgPendingInvite => invite !== null)
    : []
  return {
    members,
    pendingInvites,
    // Why: default to the least-privileged role so a malformed viewerRole can
    // never widen the client-side management affordance; the server still
    // enforces authorization on every mutation.
    viewerRole: normalizeRole(record.viewerRole, 'member'),
    canManageMembers: record.canManageMembers === true
  }
}

function orgMembersUrl(config: DolphinCloudAuthConfig, orgId: string, path: string): string {
  return `${config.apiBaseUrl}/v1/desktop/orgs/${encodeURIComponent(orgId)}${path}`
}

async function extractErrorCode(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as unknown
    if (
      body &&
      typeof body === 'object' &&
      typeof (body as { error?: unknown }).error === 'string'
    ) {
      return (body as { error: string }).error.trim() || undefined
    }
  } catch {
    // Non-JSON error body; the status code alone drives the caller's mapping.
  }
  return undefined
}

// Why: these are fixed first-party endpoints bearing the profile's access token;
// following a redirect would leak that token to another origin, and a stalled
// server must not hang the renderer's awaited IPC call forever.
function requestInit(method: 'GET' | 'POST', accessToken: string, body?: unknown): RequestInit {
  return {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      authorization: `Bearer ${accessToken}`
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: 'error',
    signal: AbortSignal.timeout(CLOUD_REQUEST_TIMEOUT_MS)
  }
}

async function requestOrgMembers<T>(
  url: string,
  init: RequestInit,
  parse: (value: unknown) => T
): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) {
    throw new DolphinCloudRequestError(response.status, await extractErrorCode(response))
  }
  return parse((await response.json()) as unknown)
}

export async function listDolphinCloudOrgMembers(
  config: DolphinCloudAuthConfig,
  session: DolphinCloudSession,
  orgId: string
): Promise<DolphinOrgMembersRoster> {
  return requestOrgMembers(
    orgMembersUrl(config, orgId, '/members'),
    requestInit('GET', session.accessToken),
    normalizeRoster
  )
}

export async function inviteDolphinCloudOrgMember(
  config: DolphinCloudAuthConfig,
  session: DolphinCloudSession,
  args: { orgId: string; email: string; role: DolphinOrgRole }
): Promise<void> {
  await requestOrgMembers(
    orgMembersUrl(config, args.orgId, '/invites'),
    requestInit('POST', session.accessToken, { email: args.email, role: args.role }),
    () => undefined
  )
}

export async function revokeDolphinCloudOrgInvite(
  config: DolphinCloudAuthConfig,
  session: DolphinCloudSession,
  args: { orgId: string; email: string }
): Promise<void> {
  await requestOrgMembers(
    orgMembersUrl(config, args.orgId, '/invites/revoke'),
    requestInit('POST', session.accessToken, { email: args.email }),
    () => undefined
  )
}

export async function changeDolphinCloudOrgMemberRole(
  config: DolphinCloudAuthConfig,
  session: DolphinCloudSession,
  args: { orgId: string; userId: string; role: DolphinOrgRole }
): Promise<void> {
  await requestOrgMembers(
    orgMembersUrl(config, args.orgId, '/members/role'),
    requestInit('POST', session.accessToken, { userId: args.userId, role: args.role }),
    () => undefined
  )
}

export type DolphinCloudAzureDevOpsLinkResponse =
  | { status: 'connected'; organizationName: string }
  | { status: 'not-registered' }
  | { status: 'invalid-credentials' }
  | { status: 'unsupported-host' }

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? Object.fromEntries(Object.entries(value)) : {}
}

function normalizeAzureDevOpsLinkResponse(value: unknown): DolphinCloudAzureDevOpsLinkResponse {
  const record = readRecord(value)
  const status = record.status
  if (status === 'connected') {
    const name = optionalString(readRecord(record.organization).name)
    if (name) {
      return { status, organizationName: name }
    }
  }
  switch (status) {
    case 'not-registered':
    case 'invalid-credentials':
    case 'unsupported-host':
      return { status }
  }
  throw new Error('invalid_dolphin_azure_devops_link_response')
}

// The Azure DevOps token goes only into this request body; the server never stores it.
export async function linkDolphinCloudOrgByAzureDevOps(
  config: DolphinCloudAuthConfig,
  session: DolphinCloudSession,
  args: { organizationUrl: string; azureDevOpsToken: string; tokenKind: 'bearer' | 'pat' }
): Promise<DolphinCloudAzureDevOpsLinkResponse> {
  return requestOrgMembers(
    `${config.apiBaseUrl}/v1/desktop/orgs/azure-devops/link`,
    requestInit('POST', session.accessToken, args),
    normalizeAzureDevOpsLinkResponse
  )
}

export async function removeDolphinCloudOrgMember(
  config: DolphinCloudAuthConfig,
  session: DolphinCloudSession,
  args: { orgId: string; userId: string }
): Promise<void> {
  await requestOrgMembers(
    orgMembersUrl(config, args.orgId, '/members/remove'),
    requestInit('POST', session.accessToken, { userId: args.userId }),
    () => undefined
  )
}
