import type { AzureDevOpsAuthStatus } from '../../shared/azure-devops-auth'
import {
  resolveAzureDevOpsLinkOrganization,
  type AzureDevOpsOrgLinkArgs,
  type AzureDevOpsOrgLinkStatus
} from '../../shared/azure-devops-org-link'
import {
  getDolphinCloudAuthConfig,
  isDolphinCloudDevAuthEnabled
} from '../dolphin-profiles/profile-cloud-auth-config'
import { linkDolphinCloudOrgByAzureDevOps } from '../dolphin-profiles/profile-cloud-org-members-client'
import { runOrgMemberCall } from '../dolphin-profiles/profile-cloud-org-members-service'
import { readDolphinCloudSession } from '../dolphin-profiles/profile-cloud-session-store'
import { ensureActiveDolphinProfile } from '../dolphin-profiles/profile-index-store'
import { getProfileUserDataPath } from '../dolphin-profiles/profile-storage-paths'
import { getAzureCliAccessToken } from './azure-cli-access-token'
import { getAzureDevOpsAuthPreference } from './azure-devops-auth-preference-store'
import { getAzureDevOpsAuthStatus, onAzureDevOpsAuthStatus } from './azure-devops-auth-status'
import { getAzureDevOpsAuthConfig } from './azure-devops-env-config'

type AzureDevOpsLinkToken = { azureDevOpsToken: string; tokenKind: 'bearer' | 'pat' }

// Only definitive answers are cached; failures retry on the next read.
const linkCache = new Map<string, AzureDevOpsOrgLinkStatus>()
const inflightLinks = new Map<string, Promise<AzureDevOpsOrgLinkStatus>>()
let lastAuthStatus: AzureDevOpsAuthStatus | null = null

/** @internal - exposed for tests only */
export function _resetAzureDevOpsOrgLinkState(): void {
  linkCache.clear()
  inflightLinks.clear()
  lastAuthStatus = null
}

// Read fresh per check and never stored: the token lives only for one request.
async function readAzureDevOpsLinkToken(
  status: AzureDevOpsAuthStatus
): Promise<AzureDevOpsLinkToken | null> {
  const method = status.authMethod ?? getAzureDevOpsAuthPreference().method
  if (method === 'azure-cli') {
    try {
      return { azureDevOpsToken: await getAzureCliAccessToken(), tokenKind: 'bearer' }
    } catch {
      return null
    }
  }
  const config = getAzureDevOpsAuthConfig()
  if (config.accessToken) {
    return { azureDevOpsToken: config.accessToken, tokenKind: 'bearer' }
  }
  return config.pat ? { azureDevOpsToken: config.pat, tokenKind: 'pat' } : null
}

function mapRequestError(
  statusCode: number,
  errorCode: string | undefined
): AzureDevOpsOrgLinkStatus {
  if (statusCode === 502) {
    return { status: 'error', reason: 'Azure DevOps is unavailable right now' }
  }
  return { status: 'error', reason: errorCode ?? `Dolphin server returned HTTP ${statusCode}` }
}

async function requestLink(
  organizationUrl: string,
  status: AzureDevOpsAuthStatus
): Promise<AzureDevOpsOrgLinkStatus> {
  const configState = getDolphinCloudAuthConfig()
  if (!configState.configured) {
    return { status: 'error', reason: configState.setupMessage }
  }
  const token = await readAzureDevOpsLinkToken(status)
  if (!token) {
    return { status: 'azure-devops-not-authenticated' }
  }
  const userDataPath = getProfileUserDataPath()
  const result = await runOrgMemberCall(
    configState.config,
    ensureActiveDolphinProfile(userDataPath),
    userDataPath,
    (session) =>
      linkDolphinCloudOrgByAzureDevOps(configState.config, session, { organizationUrl, ...token })
  )
  switch (result.status) {
    case 'ok':
      return result.value.status === 'invalid-credentials'
        ? { status: 'azure-devops-not-authenticated' }
        : result.value
    case 'reconnect-required':
      return { status: 'signed-out' }
    case 'request-error':
      return mapRequestError(result.error.statusCode, result.error.errorCode)
    case 'failed':
      return { status: 'error', reason: result.error }
  }
}

function isCacheable(result: AzureDevOpsOrgLinkStatus): boolean {
  return result.status === 'connected' || result.status === 'not-registered'
}

/** Dolphin organization the configured Azure DevOps organization links this user to. */
export async function getAzureDevOpsOrgLink(
  args: AzureDevOpsOrgLinkArgs = {}
): Promise<AzureDevOpsOrgLinkStatus> {
  const status = args.force || !lastAuthStatus ? await getAzureDevOpsAuthStatus() : lastAuthStatus
  if (!status.authenticated) {
    return { status: 'azure-devops-not-authenticated' }
  }
  if (!status.baseUrl) {
    return { status: 'no-organization' }
  }
  const organization = resolveAzureDevOpsLinkOrganization(status.baseUrl)
  if (!organization) {
    return { status: 'unsupported-host' }
  }
  if (isDolphinCloudDevAuthEnabled()) {
    return { status: 'error', reason: 'Unavailable while signed in with Dolphin dev auth' }
  }
  const userDataPath = getProfileUserDataPath()
  const active = ensureActiveDolphinProfile(userDataPath)
  const cloudUserId = active.profile.cloud?.userId
  if (!cloudUserId || readDolphinCloudSession(active.profile.id, userDataPath).status !== 'found') {
    return { status: 'signed-out' }
  }
  const key = `${userDataPath}\0${active.profile.id}\0${cloudUserId}\0${organization.organizationName}`
  const cached = linkCache.get(key)
  if (cached && !args.force) {
    return cached
  }
  // Why: the auto-check and the card's first read land together; one request serves both.
  let inflight = inflightLinks.get(key)
  if (!inflight) {
    inflight = requestLink(organization.organizationUrl, status)
      .then((result) => {
        if (isCacheable(result)) {
          linkCache.set(key, result)
        } else {
          linkCache.delete(key)
        }
        return result
      })
      .finally(() => inflightLinks.delete(key))
    inflightLinks.set(key, inflight)
  }
  return inflight
}

/** Links automatically whenever this host's Azure DevOps status turns authenticated. */
export function startAzureDevOpsOrgLinkAutoCheck(): () => void {
  return onAzureDevOpsAuthStatus((status) => {
    const wasAuthenticated =
      lastAuthStatus?.authenticated === true && lastAuthStatus.baseUrl === status.baseUrl
    lastAuthStatus = status
    if (status.authenticated && !wasAuthenticated) {
      void getAzureDevOpsOrgLink().catch(() => undefined)
    }
  })
}
