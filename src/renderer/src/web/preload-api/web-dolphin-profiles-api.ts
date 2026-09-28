import type { PreloadApi } from '../../../../preload/api-types'
import {
  DEFAULT_LOCAL_DOLPHIN_PROFILE_ID,
  createDefaultLocalDolphinProfile
} from '../../../../shared/dolphin-profiles'
import { noopUnsubscribe } from './web-storage'

export function createWebDolphinProfilesApi(): Partial<PreloadApi> {
  const webDolphinProfileAuthStatus = () =>
    Promise.resolve({
      activeProfileId: DEFAULT_LOCAL_DOLPHIN_PROFILE_ID,
      configured: false,
      state: 'unconfigured' as const,
      persistence: 'none' as const,
      setupMessage: 'Dolphin Cloud sign-in is not available in the browser fallback.'
    })
  return {
    dolphinProfiles: {
      list: () =>
        Promise.resolve({
          activeProfileId: DEFAULT_LOCAL_DOLPHIN_PROFILE_ID,
          profiles: [createDefaultLocalDolphinProfile(0)],
          multiProfileUi: false
        }),
      authStatus: webDolphinProfileAuthStatus,
      onAuthStatusChanged: () => noopUnsubscribe,
      createLocal: () =>
        Promise.resolve({
          activeProfileId: DEFAULT_LOCAL_DOLPHIN_PROFILE_ID,
          profiles: [createDefaultLocalDolphinProfile(0)],
          profile: createDefaultLocalDolphinProfile(0)
        }),
      createCloudLinked: async () => ({
        status: 'unconfigured',
        auth: await webDolphinProfileAuthStatus()
      }),
      switchProfile: () => Promise.resolve({ status: 'already-active' }),
      transferProject: (args) =>
        Promise.resolve({
          status: 'duplicate-target',
          sourceProfileId: args.sourceProfileId,
          targetProfileId: args.targetProfileId,
          sourceRepoId: args.repoId,
          duplicateRepoId: args.repoId
        }),
      findProjectProfiles: async () => ({ projects: [] }),
      connectCurrent: async () => ({
        status: 'unconfigured',
        auth: await webDolphinProfileAuthStatus()
      }),
      refreshAuth: async () => ({
        status: 'unconfigured',
        auth: await webDolphinProfileAuthStatus()
      }),
      signOutCurrent: async () => ({
        status: 'signed-out',
        auth: await webDolphinProfileAuthStatus(),
        activeProfileId: DEFAULT_LOCAL_DOLPHIN_PROFILE_ID,
        profiles: [createDefaultLocalDolphinProfile(0)]
      }),
      selectOrg: async () => ({
        status: 'unconfigured',
        auth: await webDolphinProfileAuthStatus()
      }),
      orgMembersList: async () => ({ status: 'unconfigured' }),
      orgMemberInvite: async () => ({ status: 'unconfigured' }),
      orgInviteRevoke: async () => ({ status: 'unconfigured' }),
      orgMemberChangeRole: async () => ({ status: 'unconfigured' }),
      orgMemberRemove: async () => ({ status: 'unconfigured' })
    }
  }
}
