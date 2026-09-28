import { DOLPHIN_BROWSER_PARTITION } from './constants'
import type { ExecutionHostId } from './execution-host'

export const DOLPHIN_PROFILE_INDEX_SCHEMA_VERSION = 1
export const DEFAULT_LOCAL_DOLPHIN_PROFILE_ID = 'local-default'
export const DEFAULT_LOCAL_DOLPHIN_PROFILE_NAME = 'Personal'
/** Main -> renderer push when the stored auth status changed without the renderer asking. */
export const DOLPHIN_PROFILE_AUTH_STATUS_CHANGED_CHANNEL = 'dolphinProfiles:authStatusChanged'
const LEGACY_DOLPHIN_BROWSER_SESSION_PARTITION_PREFIX = 'persist:dolphin-browser-session-'

export type DolphinProfileAvatar = {
  kind: 'initials'
  initials: string
  color: 'neutral'
}

export type DolphinProfileKind = 'local' | 'cloud-linked'

export type DolphinProfileCloudSummary = {
  cloudProfileId: string
  userId: string
  email: string
  displayName?: string
  activeOrgId?: string
  activeOrgName?: string
  linkedAt: number
}

export type DolphinCloudOrgSummary = {
  orgId: string
  name: string
  role?: string
}

export type DolphinCloudCapabilityFlags = Record<string, boolean>

export type DolphinCloudCapabilities = {
  flags: DolphinCloudCapabilityFlags
  refreshedAt: number
}

export type DolphinCloudSessionPersistence = 'none' | 'encrypted' | 'memory-only' | 'dev-plaintext'

export type DolphinProfileAuthState = 'local' | 'unconfigured' | 'connected' | 'reconnect-required'

export type DolphinProfileAuthStatus = {
  activeProfileId: string
  configured: boolean
  state: DolphinProfileAuthState
  persistence: DolphinCloudSessionPersistence
  cloud?: DolphinProfileCloudSummary
  organizations?: DolphinCloudOrgSummary[]
  capabilities?: DolphinCloudCapabilities
  credentialError?: string
  setupMessage?: string
}

export type DolphinProfileSummary = {
  id: string
  name: string
  avatar: DolphinProfileAvatar
  kind: DolphinProfileKind
  createdAt: number
  updatedAt: number
  lastOpenedAt: number
  cloud?: DolphinProfileCloudSummary
}

export type DolphinProfileIndex = {
  schemaVersion: number
  activeProfileId: string
  profiles: DolphinProfileSummary[]
}

export type DolphinProfileListState = {
  activeProfileId: string
  profiles: DolphinProfileSummary[]
}

export type DolphinProfileListResult = DolphinProfileListState & {
  // Why: gates the full multi-profile switcher UI; default builds show a
  // single-profile account menu instead.
  multiProfileUi: boolean
}

export type CreateLocalDolphinProfileArgs = {
  name?: string
}

export type CreateLocalDolphinProfileResult = DolphinProfileListState & {
  profile: DolphinProfileSummary
}

export type CreateCloudLinkedDolphinProfileArgs = {
  orgId?: string
  name?: string
}

export type SwitchDolphinProfileArgs = {
  profileId: string
}

export type SwitchDolphinProfileResult = {
  status: 'already-active' | 'relaunching'
}

export type TransferDolphinProfileProjectMode = 'move' | 'copy'

export type TransferDolphinProfileProjectArgs = {
  sourceProfileId: string
  targetProfileId: string
  repoId: string
  mode: TransferDolphinProfileProjectMode
}

export type FindDolphinProfileProjectsByPathArgs = {
  path: string
  connectionId?: string | null
  executionHostId?: ExecutionHostId | null
  excludeProfileId?: string | null
}

export type DolphinProfileProjectPresence = {
  profileId: string
  profileName: string
  profileKind: DolphinProfileKind
  repoId: string
  repoName: string
}

export type FindDolphinProfileProjectsByPathResult = {
  projects: DolphinProfileProjectPresence[]
}

export type TransferDolphinProfileProjectResult =
  | {
      status: 'transferred'
      mode: TransferDolphinProfileProjectMode
      sourceProfileId: string
      targetProfileId: string
      sourceRepoId: string
      targetRepoId: string
      targetProjectId: string | null
      willRelaunch?: boolean
    }
  | {
      status: 'duplicate-target'
      sourceProfileId: string
      targetProfileId: string
      sourceRepoId: string
      duplicateRepoId: string
    }

export type ConnectCurrentDolphinProfileResult =
  | {
      status: 'connected'
      auth: DolphinProfileAuthStatus
      activeProfileId: string
      profiles: DolphinProfileSummary[]
    }
  | {
      status: 'unconfigured'
      auth: DolphinProfileAuthStatus
    }
  | {
      status: 'cancelled'
      auth: DolphinProfileAuthStatus
    }
  | {
      status: 'failed'
      auth: DolphinProfileAuthStatus
      error: string
    }

export type CreateCloudLinkedDolphinProfileResult =
  | {
      status: 'created'
      auth: DolphinProfileAuthStatus
      activeProfileId: string
      profiles: DolphinProfileSummary[]
      profile: DolphinProfileSummary
    }
  | {
      status: 'unconfigured' | 'reconnect-required'
      auth: DolphinProfileAuthStatus
    }
  | {
      status: 'failed'
      auth: DolphinProfileAuthStatus
      error: string
    }

export type SignOutCurrentDolphinProfileResult = {
  status: 'signed-out'
  auth: DolphinProfileAuthStatus
  activeProfileId: string
  profiles: DolphinProfileSummary[]
}

export type SelectDolphinProfileOrgArgs = {
  orgId: string
}

export type SelectDolphinProfileOrgResult =
  | {
      status: 'selected'
      auth: DolphinProfileAuthStatus
      activeProfileId: string
      profiles: DolphinProfileSummary[]
    }
  | {
      status: 'unconfigured' | 'reconnect-required'
      auth: DolphinProfileAuthStatus
    }
  | {
      status: 'failed'
      auth: DolphinProfileAuthStatus
      error: string
    }

export type RefreshCurrentDolphinProfileAuthResult =
  | {
      status: 'refreshed'
      auth: DolphinProfileAuthStatus
      activeProfileId: string
      profiles: DolphinProfileSummary[]
    }
  | {
      status: 'local' | 'unconfigured' | 'reconnect-required'
      auth: DolphinProfileAuthStatus
    }
  | {
      status: 'failed'
      auth: DolphinProfileAuthStatus
      error: string
    }

// Why: organization roles are a fixed server-side enum; the desktop UI mirrors
// exactly these three so role selects can't drift from what the API accepts.
export type DolphinOrgRole = 'owner' | 'admin' | 'member'

export type DolphinOrgMember = {
  // Why: null for teammates provisioned server-side who never signed into Dolphin;
  // mutation actions are disabled for them since the API keys on a real userId.
  userId: string | null
  email: string
  displayName?: string
  role: DolphinOrgRole
}

export type DolphinOrgPendingInvite = {
  email: string
  role: DolphinOrgRole
  createdAt: number
}

export type DolphinOrgMembersRoster = {
  members: DolphinOrgMember[]
  pendingInvites: DolphinOrgPendingInvite[]
  viewerRole: DolphinOrgRole
  canManageMembers: boolean
}

export type DolphinProfileOrgMembersListArgs = {
  orgId: string
}

export type DolphinProfileOrgMemberInviteArgs = {
  orgId: string
  email: string
  role: DolphinOrgRole
}

export type DolphinProfileOrgInviteRevokeArgs = {
  orgId: string
  email: string
}

export type DolphinProfileOrgMemberChangeRoleArgs = {
  orgId: string
  userId: string
  role: DolphinOrgRole
}

export type DolphinProfileOrgMemberRemoveArgs = {
  orgId: string
  userId: string
}

export type DolphinProfileOrgMembersListResult =
  | { status: 'ok'; roster: DolphinOrgMembersRoster }
  | { status: 'unconfigured' | 'reconnect-required' }
  | { status: 'failed'; error: string }

export type DolphinOrgInviteConflictReason = 'already_member' | 'already_invited'
export type DolphinOrgMutationInvalidReason = 'cannot_change_own_role' | 'cannot_remove_self'

export type DolphinProfileOrgMemberMutationResult =
  | { status: 'ok' }
  | { status: 'unconfigured' | 'reconnect-required' | 'forbidden' | 'not-found' }
  | { status: 'conflict'; reason: DolphinOrgInviteConflictReason }
  | { status: 'invalid'; reason: DolphinOrgMutationInvalidReason }
  | { status: 'failed'; error: string }

export function createDefaultLocalDolphinProfile(now: number): DolphinProfileSummary {
  return {
    id: DEFAULT_LOCAL_DOLPHIN_PROFILE_ID,
    name: DEFAULT_LOCAL_DOLPHIN_PROFILE_NAME,
    avatar: { kind: 'initials', initials: 'P', color: 'neutral' },
    kind: 'local',
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now
  }
}

function profilePartitionHash(value: string): string {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function getDolphinProfileBrowserPartitionSegment(profileId: string): string {
  const safe = profileId.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 48) || 'profile'
  return `${safe}-${profilePartitionHash(profileId)}`
}

export function getDolphinProfileBrowserDefaultPartition(profileId: string): string {
  if (profileId === DEFAULT_LOCAL_DOLPHIN_PROFILE_ID) {
    return DOLPHIN_BROWSER_PARTITION
  }
  return `persist:dolphin-profile-${getDolphinProfileBrowserPartitionSegment(profileId)}-browser-default`
}

export function getDolphinProfileBrowserSessionPartition(
  profileId: string,
  browserSessionProfileId: string
): string {
  if (profileId === DEFAULT_LOCAL_DOLPHIN_PROFILE_ID) {
    return `${LEGACY_DOLPHIN_BROWSER_SESSION_PARTITION_PREFIX}${browserSessionProfileId}`
  }
  return `persist:dolphin-profile-${getDolphinProfileBrowserPartitionSegment(
    profileId
  )}-browser-session-${browserSessionProfileId}`
}
