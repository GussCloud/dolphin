import type {
  ConnectCurrentDolphinProfileResult,
  CreateCloudLinkedDolphinProfileArgs,
  CreateCloudLinkedDolphinProfileResult,
  DolphinProfileAuthStatus,
  SelectDolphinProfileOrgResult,
  SignOutCurrentDolphinProfileResult
} from '../../shared/dolphin-profiles'
import { ensureActiveDolphinProfile } from './profile-index-store'
import {
  getDolphinCloudAuthConfig,
  isDolphinCloudDevAuthEnabled
} from './profile-cloud-auth-config'
import {
  clearDolphinCloudSession,
  readDolphinCloudSession,
  saveDolphinCloudSessionExchange
} from './profile-cloud-session-store'
import { cloudSessionIdentity, tombstoneCloudSession } from './profile-cloud-session-mutation'
import {
  createDolphinCloudProfile,
  exchangeDolphinCloudAuthCode,
  revokeDolphinCloudSession
} from './profile-cloud-client'
import { beginDolphinCloudPkceFlow } from './profile-cloud-pkce'
import {
  createCloudLinkedDolphinProfileRecord,
  linkDolphinProfileToCloud,
  unlinkDolphinProfileFromCloud
} from './profile-cloud-index'
import { runWithFreshDolphinCloudSession } from './profile-cloud-session-refresh'
import {
  connectDevDolphinCloudProfile,
  createDevCloudLinkedDolphinProfile,
  selectDevDolphinCloudOrg
} from './profile-cloud-dev-service'
import { getDolphinProfileAuthStatusFromProfile } from './profile-cloud-auth-status'
import { selectCloudOrgWithMutationFence } from './profile-cloud-org-selection'
import {
  beginBrowserCloudSignIn,
  beginCloudConnectAttempt,
  hasCloudConnectLinkedSince,
  invalidateOutstandingCloudConnectAttempts,
  isCloudConnectAttemptSuperseded,
  markCloudConnectAttemptLinked
} from './profile-cloud-connect-attempts'
import { markDolphinCloudExplicitSignOut } from './profile-cloud-sign-out-marker'
import { emitDolphinCloudSigningOut } from './profile-cloud-sign-out-events'

export { refreshCurrentDolphinProfileAuth } from './profile-cloud-capability-refresh'

function isUserCancelledAuthError(message: string): boolean {
  return message === 'dolphin_cloud_auth_timeout' || message === 'dolphin_cloud_auth_denied'
}

function activeAuth(
  active: ReturnType<typeof ensureActiveDolphinProfile>,
  userDataPath: string
): DolphinProfileAuthStatus {
  return getDolphinProfileAuthStatusFromProfile(active, userDataPath)
}

export function getCurrentDolphinProfileAuthStatus(userDataPath: string): DolphinProfileAuthStatus {
  return getDolphinProfileAuthStatusFromProfile(
    ensureActiveDolphinProfile(userDataPath),
    userDataPath
  )
}

export async function connectCurrentDolphinProfile(
  userDataPath: string
): Promise<ConnectCurrentDolphinProfileResult> {
  const active = ensureActiveDolphinProfile(userDataPath)
  if (isDolphinCloudDevAuthEnabled()) {
    const list = connectDevDolphinCloudProfile(active, userDataPath)
    return {
      status: 'connected',
      auth: getCurrentDolphinProfileAuthStatus(userDataPath),
      activeProfileId: list.activeProfileId,
      profiles: list.profiles
    }
  }

  const configState = getDolphinCloudAuthConfig()
  if (!configState.configured) {
    return {
      status: 'unconfigured',
      auth: activeAuth(active, userDataPath)
    }
  }

  const attempt = beginCloudConnectAttempt()
  const endBrowserSignIn = beginBrowserCloudSignIn()
  try {
    const code = await beginDolphinCloudPkceFlow(configState.config, active.profile.id)
    if (isCloudConnectAttemptSuperseded(attempt)) {
      return {
        status: 'cancelled',
        auth: getCurrentDolphinProfileAuthStatus(userDataPath)
      }
    }
    const exchange = await exchangeDolphinCloudAuthCode(configState.config, {
      ...code,
      localProfileId: active.profile.id
    })
    if (isCloudConnectAttemptSuperseded(attempt)) {
      return {
        status: 'cancelled',
        auth: getCurrentDolphinProfileAuthStatus(userDataPath)
      }
    }
    saveDolphinCloudSessionExchange(active.profile.id, userDataPath, exchange)
    const list = linkDolphinProfileToCloud(active.profile.id, exchange.cloud, userDataPath)
    markCloudConnectAttemptLinked(attempt)
    return {
      status: 'connected',
      auth: getCurrentDolphinProfileAuthStatus(userDataPath),
      activeProfileId: list.activeProfileId,
      profiles: list.profiles
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (isUserCancelledAuthError(message)) {
      return {
        status: 'cancelled',
        auth: getCurrentDolphinProfileAuthStatus(userDataPath)
      }
    }
    return {
      status: 'failed',
      auth: getCurrentDolphinProfileAuthStatus(userDataPath),
      error: message
    }
  } finally {
    endBrowserSignIn()
  }
}

export async function signOutCurrentDolphinProfile(
  userDataPath: string
): Promise<SignOutCurrentDolphinProfileResult> {
  // Why: a Sign in click still waiting in the browser must not relink after
  // the user explicitly signed out.
  const signOutEpoch = invalidateOutstandingCloudConnectAttempts()
  const active = ensureActiveDolphinProfile(userDataPath)
  markDolphinCloudExplicitSignOut(active.profile.id, userDataPath)
  const configState = getDolphinCloudAuthConfig()
  const session = readDolphinCloudSession(active.profile.id, userDataPath)
  if (active.profile.cloud) {
    // Why: persist the destructive fence before logout network I/O so a
    // refresh already in flight cannot save after explicit sign-out.
    tombstoneCloudSession(
      cloudSessionIdentity(active.profile.id, active.profile.cloud),
      userDataPath
    )
  }
  if (!isDolphinCloudDevAuthEnabled() && configState.configured && session.status === 'found') {
    await emitDolphinCloudSigningOut(session.session)
    await revokeDolphinCloudSession(configState.config, session.session).catch(() => undefined)
  }
  if (hasCloudConnectLinkedSince(signOutEpoch)) {
    const current = ensureActiveDolphinProfile(userDataPath)
    return {
      status: 'signed-out',
      auth: getCurrentDolphinProfileAuthStatus(userDataPath),
      activeProfileId: current.index.activeProfileId,
      profiles: current.index.profiles
    }
  }
  clearDolphinCloudSession(active.profile.id, userDataPath)
  const list = unlinkDolphinProfileFromCloud(active.profile.id, userDataPath)
  return {
    status: 'signed-out',
    auth: getCurrentDolphinProfileAuthStatus(userDataPath),
    activeProfileId: list.activeProfileId,
    profiles: list.profiles
  }
}

export async function createCloudLinkedDolphinProfile(
  userDataPath: string,
  args: CreateCloudLinkedDolphinProfileArgs
): Promise<CreateCloudLinkedDolphinProfileResult> {
  const active = ensureActiveDolphinProfile(userDataPath)
  if (isDolphinCloudDevAuthEnabled()) {
    const result = createDevCloudLinkedDolphinProfile(active, userDataPath, args)
    if (result.status !== 'created') {
      return { status: 'reconnect-required', auth: activeAuth(active, userDataPath) }
    }
    return {
      status: 'created',
      auth: getCurrentDolphinProfileAuthStatus(userDataPath),
      activeProfileId: result.list.activeProfileId,
      profiles: result.list.profiles,
      profile: result.list.profile
    }
  }

  const configState = getDolphinCloudAuthConfig()
  if (!configState.configured) {
    return { status: 'unconfigured', auth: activeAuth(active, userDataPath) }
  }
  try {
    const operation = await runWithFreshDolphinCloudSession(
      configState.config,
      active,
      userDataPath,
      (session) => createDolphinCloudProfile(configState.config, session, args)
    )
    if (operation.status !== 'ok') {
      return { status: 'reconnect-required', auth: activeAuth(active, userDataPath) }
    }
    const created = operation.value
    const list = createCloudLinkedDolphinProfileRecord(
      created.cloud,
      { name: args.name },
      userDataPath
    )
    saveDolphinCloudSessionExchange(list.profile.id, userDataPath, created)
    return {
      status: 'created',
      auth: getCurrentDolphinProfileAuthStatus(userDataPath),
      activeProfileId: list.activeProfileId,
      profiles: list.profiles,
      profile: list.profile
    }
  } catch (error) {
    return {
      status: 'failed',
      auth: getCurrentDolphinProfileAuthStatus(userDataPath),
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export async function selectCurrentDolphinProfileOrg(
  userDataPath: string,
  orgId: string
): Promise<SelectDolphinProfileOrgResult> {
  const active = ensureActiveDolphinProfile(userDataPath)
  if (isDolphinCloudDevAuthEnabled()) {
    const result = selectDevDolphinCloudOrg(active, userDataPath, orgId)
    if (result.status !== 'updated') {
      return { status: 'reconnect-required', auth: activeAuth(active, userDataPath) }
    }
    return {
      status: 'selected',
      auth: getCurrentDolphinProfileAuthStatus(userDataPath),
      activeProfileId: result.list.activeProfileId,
      profiles: result.list.profiles
    }
  }

  const configState = getDolphinCloudAuthConfig()
  if (!configState.configured) {
    return { status: 'unconfigured', auth: activeAuth(active, userDataPath) }
  }
  try {
    const list = await selectCloudOrgWithMutationFence({
      config: configState.config,
      active,
      userDataPath,
      orgId
    })
    if (!list) {
      return { status: 'reconnect-required', auth: activeAuth(active, userDataPath) }
    }
    return {
      status: 'selected',
      auth: getCurrentDolphinProfileAuthStatus(userDataPath),
      activeProfileId: list.activeProfileId,
      profiles: list.profiles
    }
  } catch (error) {
    return {
      status: 'failed',
      auth: getCurrentDolphinProfileAuthStatus(userDataPath),
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
