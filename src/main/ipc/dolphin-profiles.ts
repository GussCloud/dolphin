import { app, ipcMain, type WebContents } from 'electron'
import type { Store } from '../persistence'
import { relaunchApp, type AppRelaunchReason } from '../app-relaunch'
import type {
  CreateLocalDolphinProfileArgs,
  CreateLocalDolphinProfileResult,
  CreateCloudLinkedDolphinProfileArgs,
  CreateCloudLinkedDolphinProfileResult,
  FindDolphinProfileProjectsByPathArgs,
  FindDolphinProfileProjectsByPathResult,
  DolphinProfileListResult,
  RefreshCurrentDolphinProfileAuthResult,
  SwitchDolphinProfileArgs,
  SwitchDolphinProfileResult,
  TransferDolphinProfileProjectArgs,
  TransferDolphinProfileProjectResult,
  ConnectCurrentDolphinProfileResult,
  DolphinProfileAuthStatus,
  SelectDolphinProfileOrgArgs,
  SelectDolphinProfileOrgResult,
  SignOutCurrentDolphinProfileResult
} from '../../shared/dolphin-profiles'
import {
  createLocalDolphinProfile,
  getDolphinProfileListState,
  seedNewDolphinProfileTelemetryConsent,
  setActiveDolphinProfile
} from '../dolphin-profiles/profile-index-store'
import {
  cloudSessionIdentity,
  recordCloudSessionIdentityMutation
} from '../dolphin-profiles/profile-cloud-session-mutation'
import { getProfileUserDataPath } from '../dolphin-profiles/profile-storage-paths'
import { isMultiProfileUiEnabled } from '../dolphin-profiles/profile-ui-scope'
import { transferDolphinProfileProject } from '../dolphin-profiles/profile-project-transfer'
import { transferActiveProfileProject } from '../dolphin-profiles/profile-active-transfer'
import { findDolphinProfileProjectsByPath } from '../dolphin-profiles/profile-project-presence'
import {
  flushActiveProfileBeforeFileMutation,
  flushActiveProfileBeforeRelaunch
} from '../dolphin-profiles/profile-persistence-deadline'
import { normalizeExecutionHostId } from '../../shared/execution-host'
import {
  createCloudLinkedDolphinProfile,
  connectCurrentDolphinProfile,
  getCurrentDolphinProfileAuthStatus,
  refreshCurrentDolphinProfileAuth,
  selectCurrentDolphinProfileOrg,
  signOutCurrentDolphinProfile
} from '../dolphin-profiles/profile-cloud-service'
import { registerDolphinProfileOrgMemberHandlers } from './dolphin-profile-org-members-handlers'
import { onDolphinCloudSessionInvalidated } from '../dolphin-profiles/profile-cloud-session-invalidation'
import { broadcastDolphinProfileAuthStatusChanged } from './dolphin-profile-auth-status-broadcast'
import { transferProjectArgsFromUnknown } from './dolphin-profile-project-transfer-args'

type RegisterDolphinProfileHandlersOptions = {
  onBeforeRelaunch?: () => void | Promise<void>
  onAuthMutation?: () => void
  onBeforeSignOut?: () => void
}

function profileIdFromArgs(args: unknown): string {
  const profileId =
    args && typeof args === 'object' && 'profileId' in args && typeof args.profileId === 'string'
      ? args.profileId.trim()
      : ''
  if (!profileId) {
    throw new Error('invalid_dolphin_profile_id')
  }
  return profileId
}

function findProjectsByPathArgsFromUnknown(args: unknown): FindDolphinProfileProjectsByPathArgs {
  if (!args || typeof args !== 'object') {
    throw new Error('invalid_dolphin_profile_project_path')
  }
  const candidate = args as FindDolphinProfileProjectsByPathArgs
  const path = typeof candidate.path === 'string' ? candidate.path.trim() : ''
  if (!path) {
    throw new Error('invalid_dolphin_profile_project_path')
  }
  let executionHostId: FindDolphinProfileProjectsByPathArgs['executionHostId'] = null
  if (candidate.executionHostId !== null && candidate.executionHostId !== undefined) {
    if (typeof candidate.executionHostId !== 'string') {
      throw new Error('invalid_dolphin_profile_project_path')
    }
    executionHostId = normalizeExecutionHostId(candidate.executionHostId)
    if (!executionHostId) {
      throw new Error('invalid_dolphin_profile_project_path')
    }
  }
  return {
    path,
    connectionId:
      typeof candidate.connectionId === 'string' ? candidate.connectionId.trim() || null : null,
    executionHostId,
    excludeProfileId:
      typeof candidate.excludeProfileId === 'string'
        ? candidate.excludeProfileId.trim() || null
        : null
  }
}

function orgIdFromUnknown(args: unknown): string {
  if (!args || typeof args !== 'object') {
    throw new Error('invalid_dolphin_profile_org_selection')
  }
  const orgId = (args as SelectDolphinProfileOrgArgs).orgId?.trim()
  if (!orgId) {
    throw new Error('invalid_dolphin_profile_org_selection')
  }
  return orgId
}

function createCloudLinkedProfileArgsFromUnknown(
  args: unknown
): CreateCloudLinkedDolphinProfileArgs {
  if (!args || typeof args !== 'object') {
    return {}
  }
  const candidate = args as CreateCloudLinkedDolphinProfileArgs
  const orgId = typeof candidate.orgId === 'string' ? candidate.orgId.trim() : undefined
  const name = typeof candidate.name === 'string' ? candidate.name.trim() : undefined
  return {
    ...(orgId ? { orgId } : {}),
    ...(name ? { name } : {})
  }
}

async function runBeforeProfileRelaunch(
  onBeforeRelaunch?: () => void | Promise<void>
): Promise<void> {
  try {
    await onBeforeRelaunch?.()
  } catch (error) {
    console.warn(
      '[dolphin-profiles] Pre-relaunch cleanup failed; continuing profile switch:',
      error instanceof Error ? error.name : typeof error
    )
  }
}

type ProfileRelaunchReason = Extract<AppRelaunchReason, `profile-${string}`>

function scheduleProfileRelaunch(reason: ProfileRelaunchReason, sender: WebContents): void {
  if (!sender.isDestroyed()) {
    sender.send('app:restart-committed')
  }
  setTimeout(() => {
    relaunchApp(reason)
    // Why: app.quit() (not app.exit) so before-quit/will-quit still run —
    // renderer scrollback capture, PTY kill, stats flush, and daemon final
    // checkpoints must not be skipped on a profile switch.
    app.quit()
  }, 150)
}

export function registerDolphinProfileHandlers(
  store: Store,
  options: RegisterDolphinProfileHandlersOptions = {}
): void {
  ipcMain.handle('dolphinProfiles:list', (): DolphinProfileListResult => ({
    ...getDolphinProfileListState(),
    multiProfileUi: isMultiProfileUiEnabled()
  }))

  ipcMain.handle('dolphinProfiles:authStatus', (): DolphinProfileAuthStatus =>
    getCurrentDolphinProfileAuthStatus(getProfileUserDataPath())
  )

  // Why: a background refresh can revoke the session with no renderer request in
  // flight, so push the change instead of waiting for the next pane to ask.
  // Why not options.onAuthMutation: that hook drives the relay coordinator, which
  // is the caller that just failed the refresh — re-entering it here would be a loop.
  onDolphinCloudSessionInvalidated(broadcastDolphinProfileAuthStatusChanged)

  ipcMain.handle(
    'dolphinProfiles:createLocal',
    (_event, args?: CreateLocalDolphinProfileArgs): CreateLocalDolphinProfileResult => {
      const result = createLocalDolphinProfile(args)
      seedNewDolphinProfileTelemetryConsent(result.profile.id, store.getSettings().telemetry)
      return result
    }
  )

  ipcMain.handle(
    'dolphinProfiles:switch',
    async (event, args: SwitchDolphinProfileArgs): Promise<SwitchDolphinProfileResult> => {
      const profileId = profileIdFromArgs(args)
      const current = getDolphinProfileListState()
      if (profileId === current.activeProfileId) {
        return { status: 'already-active' }
      }

      const activeProfile = current.profiles.find(
        (profile) => profile.id === current.activeProfileId
      )
      if (activeProfile?.cloud) {
        // Why: profile selection changes the expected identity synchronously;
        // stale refresh saves must fail even before relaunch teardown finishes.
        recordCloudSessionIdentityMutation(
          cloudSessionIdentity(activeProfile.id, activeProfile.cloud),
          getProfileUserDataPath()
        )
      }
      // Why: the current profile must be persisted before the global index
      // points startup at the target profile.
      // Switching leaves source files intact; relaunch cleanup still needs its live writer.
      await flushActiveProfileBeforeRelaunch(store)
      setActiveDolphinProfile(profileId)
      await runBeforeProfileRelaunch(options.onBeforeRelaunch)

      scheduleProfileRelaunch('profile-switch', event.sender)

      return { status: 'relaunching' }
    }
  )

  ipcMain.handle(
    'dolphinProfiles:transferProject',
    async (
      event,
      rawArgs: TransferDolphinProfileProjectArgs
    ): Promise<TransferDolphinProfileProjectResult> => {
      const args = transferProjectArgsFromUnknown(rawArgs)
      const current = getDolphinProfileListState()
      if (args.targetProfileId === current.activeProfileId) {
        throw new Error('active_target_dolphin_profile_transfer_requires_relaunch')
      }
      if (args.mode === 'move' && args.sourceProfileId === current.activeProfileId) {
        // Why: transfer before any relaunch side effect so a duplicate-target
        // or validation failure cannot strand the app in a quitting state.
        const result = await transferActiveProfileProject(
          args,
          getProfileUserDataPath(),
          store,
          async () => {
            await runBeforeProfileRelaunch(options.onBeforeRelaunch)
            scheduleProfileRelaunch('profile-transfer', event.sender)
          }
        )
        if (result.status === 'transferred') {
          await runBeforeProfileRelaunch(options.onBeforeRelaunch)
          try {
            setActiveDolphinProfile(args.targetProfileId)
          } finally {
            // The source has already changed and its writer cannot resume.
            scheduleProfileRelaunch('profile-transfer', event.sender)
          }
          return { ...result, willRelaunch: true }
        }
        return result
      }
      if (args.sourceProfileId !== current.activeProfileId) {
        await store.flushPendingOrThrowAsync({ drainToStableGeneration: false })
        return transferDolphinProfileProject(args, getProfileUserDataPath())
      }
      const maintenance = await flushActiveProfileBeforeFileMutation(store)
      try {
        return transferDolphinProfileProject(args, getProfileUserDataPath())
      } finally {
        await maintenance.resume()
      }
    }
  )

  ipcMain.handle(
    'dolphinProfiles:findProjectProfiles',
    (
      _event,
      rawArgs: FindDolphinProfileProjectsByPathArgs
    ): FindDolphinProfileProjectsByPathResult =>
      findDolphinProfileProjectsByPath(
        findProjectsByPathArgsFromUnknown(rawArgs),
        getProfileUserDataPath()
      )
  )

  ipcMain.handle(
    'dolphinProfiles:connectCurrent',
    async (): Promise<ConnectCurrentDolphinProfileResult> => {
      const result = await connectCurrentDolphinProfile(getProfileUserDataPath())
      if (result.status === 'connected') {
        options.onAuthMutation?.()
      }
      return result
    }
  )

  ipcMain.handle(
    'dolphinProfiles:createCloudLinked',
    async (
      _event,
      rawArgs?: CreateCloudLinkedDolphinProfileArgs
    ): Promise<CreateCloudLinkedDolphinProfileResult> => {
      const result = await createCloudLinkedDolphinProfile(
        getProfileUserDataPath(),
        createCloudLinkedProfileArgsFromUnknown(rawArgs)
      )
      if (result.status === 'created') {
        seedNewDolphinProfileTelemetryConsent(result.profile.id, store.getSettings().telemetry)
        options.onAuthMutation?.()
      }
      return result
    }
  )

  ipcMain.handle(
    'dolphinProfiles:refreshAuth',
    async (): Promise<RefreshCurrentDolphinProfileAuthResult> => {
      const result = await refreshCurrentDolphinProfileAuth(getProfileUserDataPath())
      if (result.status === 'refreshed') {
        options.onAuthMutation?.()
      }
      return result
    }
  )

  ipcMain.handle(
    'dolphinProfiles:signOutCurrent',
    async (): Promise<SignOutCurrentDolphinProfileResult> => {
      options.onBeforeSignOut?.()
      return signOutCurrentDolphinProfile(getProfileUserDataPath())
    }
  )

  ipcMain.handle(
    'dolphinProfiles:selectOrg',
    async (
      _event,
      rawArgs: SelectDolphinProfileOrgArgs
    ): Promise<SelectDolphinProfileOrgResult> => {
      const result = await selectCurrentDolphinProfileOrg(
        getProfileUserDataPath(),
        orgIdFromUnknown(rawArgs)
      )
      if (result.status === 'selected') {
        options.onAuthMutation?.()
      }
      return result
    }
  )

  registerDolphinProfileOrgMemberHandlers()
}
