import { ipcMain } from 'electron'
import type {
  DolphinOrgRole,
  DolphinProfileOrgInviteRevokeArgs,
  DolphinProfileOrgMemberChangeRoleArgs,
  DolphinProfileOrgMemberInviteArgs,
  DolphinProfileOrgMemberMutationResult,
  DolphinProfileOrgMemberRemoveArgs,
  DolphinProfileOrgMembersListArgs,
  DolphinProfileOrgMembersListResult
} from '../../shared/dolphin-profiles'
import { getProfileUserDataPath } from '../dolphin-profiles/profile-storage-paths'
import {
  changeDolphinProfileOrgMemberRole,
  inviteDolphinProfileOrgMember,
  listDolphinProfileOrgMembers,
  removeDolphinProfileOrgMember,
  revokeDolphinProfileOrgInvite
} from '../dolphin-profiles/profile-cloud-org-members-service'

function orgMembersScopedArgs(args: unknown): { orgId: string; record: Record<string, unknown> } {
  if (!args || typeof args !== 'object') {
    throw new Error('invalid_dolphin_profile_org_selection')
  }
  const record = args as Record<string, unknown>
  const orgId = typeof record.orgId === 'string' ? record.orgId.trim() : ''
  if (!orgId) {
    throw new Error('invalid_dolphin_profile_org_selection')
  }
  return { orgId, record }
}

function orgRoleFromUnknown(value: unknown): DolphinOrgRole {
  if (value === 'owner' || value === 'admin' || value === 'member') {
    return value
  }
  throw new Error('invalid_dolphin_org_role')
}

function orgEmailFromUnknown(value: unknown): string {
  const email = typeof value === 'string' ? value.trim() : ''
  if (!email) {
    throw new Error('invalid_dolphin_org_member_email')
  }
  return email
}

function orgUserIdFromUnknown(value: unknown): string {
  const userId = typeof value === 'string' ? value.trim() : ''
  if (!userId) {
    throw new Error('invalid_dolphin_org_member_user')
  }
  return userId
}

function orgMemberInviteArgsFromUnknown(args: unknown): DolphinProfileOrgMemberInviteArgs {
  const { orgId, record } = orgMembersScopedArgs(args)
  return { orgId, email: orgEmailFromUnknown(record.email), role: orgRoleFromUnknown(record.role) }
}

function orgInviteRevokeArgsFromUnknown(args: unknown): DolphinProfileOrgInviteRevokeArgs {
  const { orgId, record } = orgMembersScopedArgs(args)
  return { orgId, email: orgEmailFromUnknown(record.email) }
}

function orgMemberChangeRoleArgsFromUnknown(args: unknown): DolphinProfileOrgMemberChangeRoleArgs {
  const { orgId, record } = orgMembersScopedArgs(args)
  return {
    orgId,
    userId: orgUserIdFromUnknown(record.userId),
    role: orgRoleFromUnknown(record.role)
  }
}

function orgMemberRemoveArgsFromUnknown(args: unknown): DolphinProfileOrgMemberRemoveArgs {
  const { orgId, record } = orgMembersScopedArgs(args)
  return { orgId, userId: orgUserIdFromUnknown(record.userId) }
}

export function registerDolphinProfileOrgMemberHandlers(): void {
  ipcMain.handle(
    'dolphinProfiles:orgMembersList',
    async (
      _event,
      rawArgs: DolphinProfileOrgMembersListArgs
    ): Promise<DolphinProfileOrgMembersListResult> =>
      listDolphinProfileOrgMembers(getProfileUserDataPath(), orgMembersScopedArgs(rawArgs).orgId)
  )

  ipcMain.handle(
    'dolphinProfiles:orgMemberInvite',
    async (
      _event,
      rawArgs: DolphinProfileOrgMemberInviteArgs
    ): Promise<DolphinProfileOrgMemberMutationResult> =>
      inviteDolphinProfileOrgMember(
        getProfileUserDataPath(),
        orgMemberInviteArgsFromUnknown(rawArgs)
      )
  )

  ipcMain.handle(
    'dolphinProfiles:orgInviteRevoke',
    async (
      _event,
      rawArgs: DolphinProfileOrgInviteRevokeArgs
    ): Promise<DolphinProfileOrgMemberMutationResult> =>
      revokeDolphinProfileOrgInvite(
        getProfileUserDataPath(),
        orgInviteRevokeArgsFromUnknown(rawArgs)
      )
  )

  ipcMain.handle(
    'dolphinProfiles:orgMemberChangeRole',
    async (
      _event,
      rawArgs: DolphinProfileOrgMemberChangeRoleArgs
    ): Promise<DolphinProfileOrgMemberMutationResult> =>
      changeDolphinProfileOrgMemberRole(
        getProfileUserDataPath(),
        orgMemberChangeRoleArgsFromUnknown(rawArgs)
      )
  )

  ipcMain.handle(
    'dolphinProfiles:orgMemberRemove',
    async (
      _event,
      rawArgs: DolphinProfileOrgMemberRemoveArgs
    ): Promise<DolphinProfileOrgMemberMutationResult> =>
      removeDolphinProfileOrgMember(
        getProfileUserDataPath(),
        orgMemberRemoveArgsFromUnknown(rawArgs)
      )
  )
}
