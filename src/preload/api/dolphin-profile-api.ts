import type {
  ConnectCurrentDolphinProfileResult,
  CreateCloudLinkedDolphinProfileArgs,
  CreateCloudLinkedDolphinProfileResult,
  CreateLocalDolphinProfileArgs,
  CreateLocalDolphinProfileResult,
  FindDolphinProfileProjectsByPathArgs,
  FindDolphinProfileProjectsByPathResult,
  DolphinProfileAuthStatus,
  DolphinProfileListResult,
  DolphinProfileOrgInviteRevokeArgs,
  DolphinProfileOrgMemberChangeRoleArgs,
  DolphinProfileOrgMemberInviteArgs,
  DolphinProfileOrgMemberMutationResult,
  DolphinProfileOrgMemberRemoveArgs,
  DolphinProfileOrgMembersListArgs,
  DolphinProfileOrgMembersListResult,
  RefreshCurrentDolphinProfileAuthResult,
  SelectDolphinProfileOrgArgs,
  SelectDolphinProfileOrgResult,
  SignOutCurrentDolphinProfileResult,
  SwitchDolphinProfileArgs,
  SwitchDolphinProfileResult,
  TransferDolphinProfileProjectArgs,
  TransferDolphinProfileProjectResult
} from '../../shared/dolphin-profiles'

export type DolphinProfileApi = {
  list: () => Promise<DolphinProfileListResult>
  authStatus: () => Promise<DolphinProfileAuthStatus>
  /** Fires when main changed the stored auth status on its own (e.g. a revoked session). */
  onAuthStatusChanged: (callback: () => void) => () => void
  createLocal: (args?: CreateLocalDolphinProfileArgs) => Promise<CreateLocalDolphinProfileResult>
  createCloudLinked: (
    args?: CreateCloudLinkedDolphinProfileArgs
  ) => Promise<CreateCloudLinkedDolphinProfileResult>
  switchProfile: (args: SwitchDolphinProfileArgs) => Promise<SwitchDolphinProfileResult>
  transferProject: (
    args: TransferDolphinProfileProjectArgs
  ) => Promise<TransferDolphinProfileProjectResult>
  findProjectProfiles: (
    args: FindDolphinProfileProjectsByPathArgs
  ) => Promise<FindDolphinProfileProjectsByPathResult>
  connectCurrent: () => Promise<ConnectCurrentDolphinProfileResult>
  refreshAuth: () => Promise<RefreshCurrentDolphinProfileAuthResult>
  signOutCurrent: () => Promise<SignOutCurrentDolphinProfileResult>
  selectOrg: (args: SelectDolphinProfileOrgArgs) => Promise<SelectDolphinProfileOrgResult>
  orgMembersList: (
    args: DolphinProfileOrgMembersListArgs
  ) => Promise<DolphinProfileOrgMembersListResult>
  orgMemberInvite: (
    args: DolphinProfileOrgMemberInviteArgs
  ) => Promise<DolphinProfileOrgMemberMutationResult>
  orgInviteRevoke: (
    args: DolphinProfileOrgInviteRevokeArgs
  ) => Promise<DolphinProfileOrgMemberMutationResult>
  orgMemberChangeRole: (
    args: DolphinProfileOrgMemberChangeRoleArgs
  ) => Promise<DolphinProfileOrgMemberMutationResult>
  orgMemberRemove: (
    args: DolphinProfileOrgMemberRemoveArgs
  ) => Promise<DolphinProfileOrgMemberMutationResult>
}
