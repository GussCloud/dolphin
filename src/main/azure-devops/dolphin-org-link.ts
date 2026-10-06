import type { AzureDevOpsAuthStatus } from '../../shared/azure-devops-auth'
import {
  resolveAzureDevOpsLinkOrganization,
  type AzureDevOpsLinkOrganization,
  type AzureDevOpsOrgLinkArgs,
  type AzureDevOpsOrgLinkStatus
} from '../../shared/azure-devops-org-link'
import {
  getDolphinCloudAuthConfig,
  isDolphinCloudDevAuthEnabled
} from '../dolphin-profiles/profile-cloud-auth-config'
import {
  signInCurrentDolphinProfileWithAzureDevOps,
  type AzureDevOpsDolphinSignInResult
} from '../dolphin-profiles/profile-cloud-azure-devops-sign-in'
import { DolphinCloudRequestError } from '../dolphin-profiles/profile-cloud-client'
import { linkDolphinCloudOrgByAzureDevOps } from '../dolphin-profiles/profile-cloud-org-members-client'
import { runOrgMemberCall } from '../dolphin-profiles/profile-cloud-org-members-service'
import { readDolphinCloudSession } from '../dolphin-profiles/profile-cloud-session-store'
import { onDolphinCloudSignedIn } from '../dolphin-profiles/profile-cloud-sign-in-events'
import { hasDolphinCloudExplicitSignOut } from '../dolphin-profiles/profile-cloud-sign-out-marker'
import { ensureActiveDolphinProfile } from '../dolphin-profiles/profile-index-store'
import { getProfileUserDataPath } from '../dolphin-profiles/profile-storage-paths'
import { getAzureCliAccessToken } from './azure-cli-access-token'
import { getAzureDevOpsAuthPreference } from './azure-devops-auth-preference-store'
import { getAzureDevOpsAuthStatus, onAzureDevOpsAuthStatus } from './azure-devops-auth-status'
import { getAzureDevOpsAuthConfig } from './azure-devops-env-config'

type AzureDevOpsLinkToken = { azureDevOpsToken: string; tokenKind: 'bearer' | 'pat' }

// Why: an admin may register the organization after a miss, so not-registered expires
// sooner; connected still expires so a removed membership is noticed. Failures never cache.
const NOT_REGISTERED_TTL_MS = 10 * 60_000
const CONNECTED_TTL_MS = 60 * 60_000

type CachedLink = { result: AzureDevOpsOrgLinkStatus; expiresAtMs: number }

export type AzureDevOpsOrgLinkAutoCheckOptions = {
  // Runs after an Azure DevOps sign-in stored a Dolphin session no renderer asked for.
  onDolphinSignedIn?: () => void
}

const linkCache = new Map<string, CachedLink>()
const inflightLinks = new Map<string, Promise<AzureDevOpsOrgLinkStatus>>()
let lastAuthStatus: AzureDevOpsAuthStatus | null = null
let notifyDolphinSignedIn: (() => void) | null = null

/** @internal - exposed for tests only */
export function _resetAzureDevOpsOrgLinkState(): void {
  linkCache.clear()
  inflightLinks.clear()
  lastAuthStatus = null
  notifyDolphinSignedIn = null
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
        ? { ...result.value, status: 'azure-devops-not-authenticated' }
        : result.value
    case 'reconnect-required':
      return { status: 'signed-out' }
    case 'request-error':
      return mapRequestError(result.error.statusCode, result.error.errorCode)
    case 'failed':
      return { status: 'error', reason: result.error }
  }
}

async function requestSignIn(
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
  let result: AzureDevOpsDolphinSignInResult
  try {
    result = await signInCurrentDolphinProfileWithAzureDevOps(
      configState.config,
      getProfileUserDataPath(),
      { organizationUrl, ...token }
    )
  } catch (error) {
    return error instanceof DolphinCloudRequestError
      ? mapRequestError(error.statusCode, error.errorCode)
      : { status: 'error', reason: error instanceof Error ? error.message : String(error) }
  }
  switch (result.status) {
    case 'signed-in':
      notifyDolphinSignedIn?.()
      return { status: 'connected', organizationName: result.organizationName }
    case 'invalid-credentials':
      return { ...result, status: 'azure-devops-not-authenticated' }
    case 'superseded':
      // Why: the browser sign-in or sign-out that overtook this one decides what to show.
      return resolveOrgLink(status, { force: true }, false)
    case 'not-registered':
    case 'unsupported-host':
    case 'account-exists':
      return result
  }
}

function cacheTtlMs(result: AzureDevOpsOrgLinkStatus): number | null {
  if (result.status === 'connected') {
    return CONNECTED_TTL_MS
  }
  // Why: account-exists ends in a Dolphin sign-in, whose event clears the cache.
  return result.status === 'not-registered' || result.status === 'account-exists'
    ? NOT_REGISTERED_TTL_MS
    : null
}

function cachedOrRequest(
  key: string,
  force: boolean | undefined,
  request: () => Promise<AzureDevOpsOrgLinkStatus>
): Promise<AzureDevOpsOrgLinkStatus> {
  const cached = linkCache.get(key)
  if (cached && cached.expiresAtMs > Date.now() && !force) {
    return Promise.resolve(cached.result)
  }
  // Why: the auto-check and the card's first read land together; one request serves both.
  let inflight = inflightLinks.get(key)
  if (!inflight) {
    inflight = request()
      .then((result) => {
        const ttlMs = cacheTtlMs(result)
        if (ttlMs !== null) {
          linkCache.set(key, { result, expiresAtMs: Date.now() + ttlMs })
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

// Without a Dolphin session the Azure DevOps token signs the user in, unless they
// explicitly signed out of Dolphin on this profile and did not press Sign in.
async function resolveSignedOut(
  userDataPath: string,
  profileId: string,
  organization: AzureDevOpsLinkOrganization,
  status: AzureDevOpsAuthStatus,
  args: AzureDevOpsOrgLinkArgs
): Promise<AzureDevOpsOrgLinkStatus> {
  // Why: an unreadable session file may still hold a valid session; never replace it.
  if (readDolphinCloudSession(profileId, userDataPath).status === 'unreadable') {
    return { status: 'signed-out' }
  }
  if (!args.signIn && hasDolphinCloudExplicitSignOut(profileId, userDataPath)) {
    return { status: 'signed-out' }
  }
  const key = `${userDataPath}\0${profileId}\0sign-in\0${organization.organizationName}`
  return cachedOrRequest(key, args.force || args.signIn, () =>
    requestSignIn(organization.organizationUrl, status)
  )
}

async function resolveOrgLink(
  status: AzureDevOpsAuthStatus,
  args: AzureDevOpsOrgLinkArgs,
  allowSignIn: boolean
): Promise<AzureDevOpsOrgLinkStatus> {
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
    return allowSignIn
      ? resolveSignedOut(userDataPath, active.profile.id, organization, status, args)
      : { status: 'signed-out' }
  }
  const key = `${userDataPath}\0${active.profile.id}\0${cloudUserId}\0${organization.organizationName}`
  return cachedOrRequest(key, args.force, () => requestLink(organization.organizationUrl, status))
}

/** Dolphin organization the configured Azure DevOps organization links this user to. */
export async function getAzureDevOpsOrgLink(
  args: AzureDevOpsOrgLinkArgs = {}
): Promise<AzureDevOpsOrgLinkStatus> {
  const status = args.force || !lastAuthStatus ? await getAzureDevOpsAuthStatus() : lastAuthStatus
  return resolveOrgLink(status, args, true)
}

function checkInBackground(): void {
  void getAzureDevOpsOrgLink().catch(() => undefined)
}

/** Links (or signs in) on each authenticated status and after every Dolphin sign-in. */
export function startAzureDevOpsOrgLinkAutoCheck(
  options: AzureDevOpsOrgLinkAutoCheckOptions = {}
): () => void {
  notifyDolphinSignedIn = options.onDolphinSignedIn ?? null
  // Why: the cache makes a fresh answer free, so every status probe can also renew an expired one.
  const stopAuthStatus = onAzureDevOpsAuthStatus((status) => {
    lastAuthStatus = status
    if (status.authenticated) {
      checkInBackground()
    }
  })
  // Why: signing in again (or as another user) must not wait out a cached miss.
  const stopSignIn = onDolphinCloudSignedIn(() => {
    linkCache.clear()
    if (lastAuthStatus?.authenticated) {
      checkInBackground()
    }
  })
  return () => {
    stopAuthStatus()
    stopSignIn()
    notifyDolphinSignedIn = null
  }
}
