import type {
  CreateCloudLinkedDolphinProfileArgs,
  DolphinProfileListState
} from '../../shared/dolphin-profiles'
import type { ActiveDolphinProfileState } from './profile-index-store'
import {
  createCloudLinkedDolphinProfileRecord,
  linkDolphinProfileToCloud
} from './profile-cloud-index'
import {
  readDolphinCloudSession,
  saveDolphinCloudSessionExchange
} from './profile-cloud-session-store'
import { createDevDolphinCloudSession } from './profile-cloud-dev-auth'

type DevProfileListResult = DolphinProfileListState

type DevCreateProfileResult =
  | {
      status: 'created'
      list: ReturnType<typeof createCloudLinkedDolphinProfileRecord>
    }
  | { status: 'reconnect-required' }

type DevMutationResult =
  | {
      status: 'updated'
      list: DevProfileListResult
    }
  | { status: 'reconnect-required' }

export function connectDevDolphinCloudProfile(
  active: ActiveDolphinProfileState,
  userDataPath: string
): DevProfileListResult {
  const session = createDevDolphinCloudSession({ localProfileId: active.profile.id })
  saveDolphinCloudSessionExchange(active.profile.id, userDataPath, session)
  return linkDolphinProfileToCloud(active.profile.id, session.cloud, userDataPath)
}

export function createDevCloudLinkedDolphinProfile(
  active: ActiveDolphinProfileState,
  userDataPath: string,
  args: CreateCloudLinkedDolphinProfileArgs
): DevCreateProfileResult {
  if (readDolphinCloudSession(active.profile.id, userDataPath).status !== 'found') {
    return { status: 'reconnect-required' }
  }
  const session = createDevDolphinCloudSession({ orgId: args.orgId })
  const list = createCloudLinkedDolphinProfileRecord(
    session.cloud,
    { name: args.name },
    userDataPath
  )
  saveDolphinCloudSessionExchange(list.profile.id, userDataPath, session)
  return { status: 'created', list }
}

export function refreshDevDolphinCloudProfile(
  active: ActiveDolphinProfileState,
  userDataPath: string
): DevMutationResult {
  if (
    !active.profile.cloud ||
    readDolphinCloudSession(active.profile.id, userDataPath).status !== 'found'
  ) {
    return { status: 'reconnect-required' }
  }
  const session = createDevDolphinCloudSession({
    localProfileId: active.profile.id,
    cloudProfileId: active.profile.cloud.cloudProfileId,
    orgId: active.profile.cloud.activeOrgId
  })
  saveDolphinCloudSessionExchange(active.profile.id, userDataPath, session)
  return {
    status: 'updated',
    list: linkDolphinProfileToCloud(active.profile.id, session.cloud, userDataPath)
  }
}

export function selectDevDolphinCloudOrg(
  active: ActiveDolphinProfileState,
  userDataPath: string,
  orgId: string
): DevMutationResult {
  if (
    !active.profile.cloud ||
    readDolphinCloudSession(active.profile.id, userDataPath).status !== 'found'
  ) {
    return { status: 'reconnect-required' }
  }
  const session = createDevDolphinCloudSession({
    localProfileId: active.profile.id,
    cloudProfileId: active.profile.cloud.cloudProfileId,
    orgId
  })
  saveDolphinCloudSessionExchange(active.profile.id, userDataPath, session)
  return {
    status: 'updated',
    list: linkDolphinProfileToCloud(active.profile.id, session.cloud, userDataPath)
  }
}
