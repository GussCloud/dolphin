import type {
  DolphinProfileOrgInviteRevokeArgs,
  DolphinProfileOrgMemberChangeRoleArgs,
  DolphinProfileOrgMemberInviteArgs,
  DolphinProfileOrgMemberMutationResult,
  DolphinProfileOrgMemberRemoveArgs,
  DolphinProfileOrgMembersListResult
} from '../../shared/dolphin-profiles'
import type { ActiveDolphinProfileState } from './profile-index-store'
import { ensureActiveDolphinProfile } from './profile-index-store'
import type { DolphinCloudAuthConfig } from './profile-cloud-auth-config'
import {
  getDolphinCloudAuthConfig,
  isDolphinCloudDevAuthEnabled
} from './profile-cloud-auth-config'
import type { DolphinCloudSession } from './profile-cloud-session-store'
import { DolphinCloudRequestError } from './profile-cloud-client'
import { runWithFreshDolphinCloudSession } from './profile-cloud-session-refresh'
import {
  changeDolphinCloudOrgMemberRole,
  inviteDolphinCloudOrgMember,
  listDolphinCloudOrgMembers,
  removeDolphinCloudOrgMember,
  revokeDolphinCloudOrgInvite
} from './profile-cloud-org-members-client'
import {
  changeDevDolphinCloudOrgMemberRole,
  inviteDevDolphinCloudOrgMember,
  listDevDolphinCloudOrgMembers,
  removeDevDolphinCloudOrgMember,
  revokeDevDolphinCloudOrgInvite
} from './profile-cloud-dev-org-members'

export type OrgCallResult<T> =
  | { status: 'ok'; value: T }
  | { status: 'reconnect-required' }
  | { status: 'request-error'; error: DolphinCloudRequestError }
  | { status: 'failed'; error: string }

// Why: only a 401 means the token itself is stale and should drive a session
// refresh/reconnect. 403/404/409/400 are business or permission outcomes the UI
// must interpret, so they are surfaced as values rather than thrown — otherwise
// runWithFreshDolphinCloudSession would treat a 403 as an auth failure and burn a
// pointless token refresh + retry before giving up.
export async function runOrgMemberCall<T>(
  config: DolphinCloudAuthConfig,
  active: ActiveDolphinProfileState,
  userDataPath: string,
  call: (session: DolphinCloudSession) => Promise<T>
): Promise<OrgCallResult<T>> {
  try {
    const operation = await runWithFreshDolphinCloudSession(
      config,
      active,
      userDataPath,
      async (session) => {
        try {
          return { ok: true as const, value: await call(session) }
        } catch (error) {
          if (error instanceof DolphinCloudRequestError && error.statusCode !== 401) {
            return { ok: false as const, error }
          }
          throw error
        }
      }
    )
    if (operation.status !== 'ok') {
      return { status: 'reconnect-required' }
    }
    const outcome = operation.value
    return outcome.ok
      ? { status: 'ok', value: outcome.value }
      : { status: 'request-error', error: outcome.error }
  } catch (error) {
    return { status: 'failed', error: error instanceof Error ? error.message : String(error) }
  }
}

function mapMutationRequestError(
  error: DolphinCloudRequestError
): DolphinProfileOrgMemberMutationResult {
  switch (error.statusCode) {
    case 403:
      return { status: 'forbidden' }
    case 404:
      return { status: 'not-found' }
    case 409:
      return {
        status: 'conflict',
        reason: error.errorCode === 'already_member' ? 'already_member' : 'already_invited'
      }
    case 400:
      return {
        status: 'invalid',
        reason:
          error.errorCode === 'cannot_remove_self' ? 'cannot_remove_self' : 'cannot_change_own_role'
      }
    default:
      return { status: 'failed', error: error.message }
  }
}

function mapMutationResult(result: OrgCallResult<void>): DolphinProfileOrgMemberMutationResult {
  switch (result.status) {
    case 'ok':
      return { status: 'ok' }
    case 'reconnect-required':
      return { status: 'reconnect-required' }
    case 'request-error':
      return mapMutationRequestError(result.error)
    case 'failed':
      return { status: 'failed', error: result.error }
  }
}

export async function listDolphinProfileOrgMembers(
  userDataPath: string,
  orgId: string
): Promise<DolphinProfileOrgMembersListResult> {
  const active = ensureActiveDolphinProfile(userDataPath)
  if (isDolphinCloudDevAuthEnabled()) {
    return { status: 'ok', roster: listDevDolphinCloudOrgMembers(orgId) }
  }
  const configState = getDolphinCloudAuthConfig()
  if (!configState.configured) {
    return { status: 'unconfigured' }
  }
  const result = await runOrgMemberCall(configState.config, active, userDataPath, (session) =>
    listDolphinCloudOrgMembers(configState.config, session, orgId)
  )
  switch (result.status) {
    case 'ok':
      return { status: 'ok', roster: result.value }
    case 'reconnect-required':
      return { status: 'reconnect-required' }
    case 'request-error':
      return { status: 'failed', error: result.error.message }
    case 'failed':
      return { status: 'failed', error: result.error }
  }
}

export async function inviteDolphinProfileOrgMember(
  userDataPath: string,
  args: DolphinProfileOrgMemberInviteArgs
): Promise<DolphinProfileOrgMemberMutationResult> {
  const active = ensureActiveDolphinProfile(userDataPath)
  if (isDolphinCloudDevAuthEnabled()) {
    return inviteDevDolphinCloudOrgMember(args)
  }
  const configState = getDolphinCloudAuthConfig()
  if (!configState.configured) {
    return { status: 'unconfigured' }
  }
  return mapMutationResult(
    await runOrgMemberCall(configState.config, active, userDataPath, (session) =>
      inviteDolphinCloudOrgMember(configState.config, session, args)
    )
  )
}

export async function revokeDolphinProfileOrgInvite(
  userDataPath: string,
  args: DolphinProfileOrgInviteRevokeArgs
): Promise<DolphinProfileOrgMemberMutationResult> {
  const active = ensureActiveDolphinProfile(userDataPath)
  if (isDolphinCloudDevAuthEnabled()) {
    return revokeDevDolphinCloudOrgInvite(args)
  }
  const configState = getDolphinCloudAuthConfig()
  if (!configState.configured) {
    return { status: 'unconfigured' }
  }
  return mapMutationResult(
    await runOrgMemberCall(configState.config, active, userDataPath, (session) =>
      revokeDolphinCloudOrgInvite(configState.config, session, args)
    )
  )
}

export async function changeDolphinProfileOrgMemberRole(
  userDataPath: string,
  args: DolphinProfileOrgMemberChangeRoleArgs
): Promise<DolphinProfileOrgMemberMutationResult> {
  const active = ensureActiveDolphinProfile(userDataPath)
  if (isDolphinCloudDevAuthEnabled()) {
    return changeDevDolphinCloudOrgMemberRole(args)
  }
  const configState = getDolphinCloudAuthConfig()
  if (!configState.configured) {
    return { status: 'unconfigured' }
  }
  return mapMutationResult(
    await runOrgMemberCall(configState.config, active, userDataPath, (session) =>
      changeDolphinCloudOrgMemberRole(configState.config, session, args)
    )
  )
}

export async function removeDolphinProfileOrgMember(
  userDataPath: string,
  args: DolphinProfileOrgMemberRemoveArgs
): Promise<DolphinProfileOrgMemberMutationResult> {
  const active = ensureActiveDolphinProfile(userDataPath)
  if (isDolphinCloudDevAuthEnabled()) {
    return removeDevDolphinCloudOrgMember(args)
  }
  const configState = getDolphinCloudAuthConfig()
  if (!configState.configured) {
    return { status: 'unconfigured' }
  }
  return mapMutationResult(
    await runOrgMemberCall(configState.config, active, userDataPath, (session) =>
      removeDolphinCloudOrgMember(configState.config, session, args)
    )
  )
}
