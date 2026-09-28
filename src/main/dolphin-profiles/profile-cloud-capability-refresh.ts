import type { RefreshCurrentDolphinProfileAuthResult } from '../../shared/dolphin-profiles'
import {
  getDolphinCloudAuthConfig,
  isDolphinCloudDevAuthEnabled
} from './profile-cloud-auth-config'
import { getDolphinProfileAuthStatusFromProfile } from './profile-cloud-auth-status'
import { refreshDolphinCloudCapabilities } from './profile-cloud-client'
import { linkDolphinProfileToCloud } from './profile-cloud-index'
import { ensureActiveDolphinProfile, getDolphinProfileListState } from './profile-index-store'
import { refreshDevDolphinCloudProfile } from './profile-cloud-dev-service'
import {
  captureCloudSessionMutation,
  cloudSessionIdentity,
  recordCloudSessionIdentityMutationIfCurrent
} from './profile-cloud-session-mutation'
import { runWithFreshDolphinCloudSession } from './profile-cloud-session-refresh'
import {
  readDolphinCloudSession,
  saveDolphinCloudSessionIfCurrent
} from './profile-cloud-session-store'

export async function refreshCurrentDolphinProfileAuth(
  userDataPath: string
): Promise<RefreshCurrentDolphinProfileAuthResult> {
  const active = ensureActiveDolphinProfile(userDataPath)
  const auth = () => getDolphinProfileAuthStatusFromProfile(active, userDataPath)
  if (!active.profile.cloud) {
    return { status: 'local', auth: auth() }
  }
  if (isDolphinCloudDevAuthEnabled()) {
    const result = refreshDevDolphinCloudProfile(active, userDataPath)
    if (result.status !== 'updated') {
      return { status: 'reconnect-required', auth: auth() }
    }
    return {
      status: 'refreshed',
      auth: auth(),
      activeProfileId: result.list.activeProfileId,
      profiles: result.list.profiles
    }
  }
  const configState = getDolphinCloudAuthConfig()
  if (!configState.configured) {
    return { status: 'unconfigured', auth: auth() }
  }
  try {
    const identity = cloudSessionIdentity(active.profile.id, active.profile.cloud)
    let mutationSnapshot = captureCloudSessionMutation(identity, userDataPath)
    const operation = await runWithFreshDolphinCloudSession(
      configState.config,
      active,
      userDataPath,
      (session) => refreshDolphinCloudCapabilities(configState.config, session)
    )
    if (operation.status !== 'ok') {
      return { status: 'reconnect-required', auth: auth() }
    }
    const refresh = operation.value
    if (refresh.cloud) {
      const refreshedIdentity = cloudSessionIdentity(active.profile.id, refresh.cloud)
      if (
        refreshedIdentity.cloudUserId !== identity.cloudUserId ||
        refreshedIdentity.cloudProfileId !== identity.cloudProfileId
      ) {
        throw new Error('dolphin_cloud_identity_changed_during_capability_refresh')
      }
      if (refreshedIdentity.organizationId !== identity.organizationId) {
        const advanced = recordCloudSessionIdentityMutationIfCurrent(
          refreshedIdentity,
          userDataPath,
          mutationSnapshot
        )
        if (!advanced) {
          return { status: 'reconnect-required', auth: auth() }
        }
        mutationSnapshot = advanced
      }
    }
    const session = readDolphinCloudSession(active.profile.id, userDataPath)
    if (session.status !== 'found') {
      return { status: 'reconnect-required', auth: auth() }
    }
    if (
      saveDolphinCloudSessionIfCurrent(
        active.profile.id,
        userDataPath,
        {
          ...session.session,
          organizations: refresh.organizations ?? session.session.organizations,
          capabilities: refresh.capabilities
        },
        mutationSnapshot
      ) === null
    ) {
      return { status: 'reconnect-required', auth: auth() }
    }
    const list = refresh.cloud
      ? linkDolphinProfileToCloud(active.profile.id, refresh.cloud, userDataPath)
      : getDolphinProfileListState(userDataPath)
    return {
      status: 'refreshed',
      auth: getDolphinProfileAuthStatusFromProfile(
        ensureActiveDolphinProfile(userDataPath),
        userDataPath
      ),
      activeProfileId: list.activeProfileId,
      profiles: list.profiles
    }
  } catch (error) {
    return {
      status: 'failed',
      auth: auth(),
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
