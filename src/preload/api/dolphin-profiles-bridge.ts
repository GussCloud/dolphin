import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'
import {
  DOLPHIN_PROFILE_AUTH_STATUS_CHANGED_CHANNEL,
  type DolphinProfileListResult,
  type SwitchDolphinProfileResult,
  type TransferDolphinProfileProjectResult
} from '../../shared/dolphin-profiles'
import { prepareAndInvokeAppRestart } from '../renderer-restart-wiring'
import { awaitBeforeUnloadCheckpoint } from '../preload-runtime-support'

export const dolphinProfilesApi = {
  list: () => ipcRenderer.invoke('dolphinProfiles:list'),
  authStatus: () => ipcRenderer.invoke('dolphinProfiles:authStatus'),
  onAuthStatusChanged: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on(DOLPHIN_PROFILE_AUTH_STATUS_CHANGED_CHANNEL, listener)
    return () => ipcRenderer.removeListener(DOLPHIN_PROFILE_AUTH_STATUS_CHANGED_CHANNEL, listener)
  },
  createLocal: (args) => ipcRenderer.invoke('dolphinProfiles:createLocal', args),
  createCloudLinked: (args) => ipcRenderer.invoke('dolphinProfiles:createCloudLinked', args),
  switchProfile: (args) =>
    prepareAndInvokeAppRestart(
      window,
      (): Promise<SwitchDolphinProfileResult> => ipcRenderer.invoke('dolphinProfiles:switch', args),
      awaitBeforeUnloadCheckpoint,
      (result) => result.status === 'relaunching'
    ),
  transferProject: async (args) => {
    const invoke = (): Promise<TransferDolphinProfileProjectResult> =>
      ipcRenderer.invoke('dolphinProfiles:transferProject', args)
    if (args.mode !== 'move') {
      return invoke()
    }
    const current: DolphinProfileListResult = await ipcRenderer.invoke('dolphinProfiles:list')
    if (args.sourceProfileId !== current.activeProfileId) {
      return invoke()
    }
    return prepareAndInvokeAppRestart(
      window,
      invoke,
      awaitBeforeUnloadCheckpoint,
      (result) => result.status === 'transferred' && result.willRelaunch === true
    )
  },
  findProjectProfiles: (args) => ipcRenderer.invoke('dolphinProfiles:findProjectProfiles', args),
  connectCurrent: () => ipcRenderer.invoke('dolphinProfiles:connectCurrent'),
  refreshAuth: () => ipcRenderer.invoke('dolphinProfiles:refreshAuth'),
  signOutCurrent: () => ipcRenderer.invoke('dolphinProfiles:signOutCurrent'),
  selectOrg: (args) => ipcRenderer.invoke('dolphinProfiles:selectOrg', args),
  orgMembersList: (args) => ipcRenderer.invoke('dolphinProfiles:orgMembersList', args),
  orgMemberInvite: (args) => ipcRenderer.invoke('dolphinProfiles:orgMemberInvite', args),
  orgInviteRevoke: (args) => ipcRenderer.invoke('dolphinProfiles:orgInviteRevoke', args),
  orgMemberChangeRole: (args) => ipcRenderer.invoke('dolphinProfiles:orgMemberChangeRole', args),
  orgMemberRemove: (args) => ipcRenderer.invoke('dolphinProfiles:orgMemberRemove', args)
} satisfies PreloadApi['dolphinProfiles']
