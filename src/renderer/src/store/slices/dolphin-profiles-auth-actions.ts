import type { StateCreator } from 'zustand'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type {
  ConnectCurrentDolphinProfileResult,
  CreateCloudLinkedDolphinProfileResult,
  RefreshCurrentDolphinProfileAuthResult,
  SelectDolphinProfileOrgResult,
  SignOutCurrentDolphinProfileResult
} from '../../../../shared/dolphin-profiles'
import type { AppState } from '../types'

export type DolphinProfilesAuthActions = {
  createCloudLinkedDolphinProfile: (args: {
    orgId?: string
    name?: string
  }) => Promise<CreateCloudLinkedDolphinProfileResult | null>
  connectCurrentDolphinProfile: () => Promise<ConnectCurrentDolphinProfileResult | null>
  refreshCurrentDolphinProfileAuth: () => Promise<RefreshCurrentDolphinProfileAuthResult | null>
  signOutCurrentDolphinProfile: () => Promise<SignOutCurrentDolphinProfileResult | null>
  selectDolphinProfileOrg: (orgId: string) => Promise<SelectDolphinProfileOrgResult | null>
}

// Why a separate module: the cloud-auth actions share the profiles slice's
// state keys but form their own cohesive surface (connect/refresh/sign-out/
// org selection), and the combined slice file exceeded the repo line budget.
export const createDolphinProfilesAuthActions: StateCreator<
  AppState,
  [],
  [],
  DolphinProfilesAuthActions
> = (set, get) => {
  let nextConnectAttempt = 0
  let appliedConnectAttempt = 0

  return {
    createCloudLinkedDolphinProfile: async (args) => {
      try {
        const result = await window.api.dolphinProfiles.createCloudLinked(args)
        set({
          dolphinProfileAuthStatus: result.auth,
          ...(result.status === 'created'
            ? {
                activeDolphinProfileId: result.activeProfileId,
                dolphinProfiles: result.profiles
              }
            : {})
        })
        if (result.status === 'created') {
          toast.success(
            translate('auto.store.slices.dolphin.profiles.319d7cf39b', 'Cloud profile created')
          )
        } else if (result.status === 'reconnect-required') {
          toast.error(
            translate('auto.store.slices.dolphin.profiles.d6e764e7db', 'Reconnect this profile')
          )
        } else if (result.status === 'failed') {
          toast.error(
            translate(
              'auto.store.slices.dolphin.profiles.f0c9e11a6d',
              'Failed to create cloud profile'
            ),
            { description: result.error }
          )
        }
        return result
      } catch (err) {
        console.error('Failed to create Dolphin cloud profile:', err)
        toast.error(
          translate(
            'auto.store.slices.dolphin.profiles.f0c9e11a6d',
            'Failed to create cloud profile'
          ),
          {
            description: err instanceof Error ? err.message : String(err)
          }
        )
        return null
      }
    },

    connectCurrentDolphinProfile: async () => {
      const attempt = ++nextConnectAttempt
      try {
        // Why: a pending browser callback must not block retry. Another click
        // starts a second PKCE wait; an older wait is ignored after a newer
        // one has already linked.
        const result = await window.api.dolphinProfiles.connectCurrent()
        if (attempt < appliedConnectAttempt) {
          return result
        }
        const alreadyConnected = get().dolphinProfileAuthStatus?.state === 'connected'
        set({
          dolphinProfileAuthStatus: result.auth,
          ...(result.status === 'connected'
            ? {
                activeDolphinProfileId: result.activeProfileId,
                dolphinProfiles: result.profiles
              }
            : {})
        })
        if (result.status === 'connected') {
          appliedConnectAttempt = attempt
          if (!alreadyConnected) {
            toast.success(
              translate('auto.store.slices.dolphin.profiles.9fcb07a796', 'Profile connected')
            )
          }
        } else if (result.status === 'unconfigured') {
          toast.error(
            translate(
              'auto.store.slices.dolphin.profiles.8b8fa73174',
              'Dolphin Cloud sign-in is not configured'
            ),
            {
              description: result.auth.setupMessage
            }
          )
        } else if (
          result.status === 'failed' &&
          !alreadyConnected &&
          result.auth.state !== 'connected'
        ) {
          toast.error(
            translate('auto.store.slices.dolphin.profiles.33290e88ed', 'Failed to connect profile'),
            { description: result.error }
          )
        }
        return result
      } catch (err) {
        console.error('Failed to connect Dolphin profile:', err)
        if (
          attempt >= appliedConnectAttempt &&
          get().dolphinProfileAuthStatus?.state !== 'connected'
        ) {
          toast.error(
            translate('auto.store.slices.dolphin.profiles.33290e88ed', 'Failed to connect profile'),
            {
              description: err instanceof Error ? err.message : String(err)
            }
          )
        }
        return null
      }
    },

    refreshCurrentDolphinProfileAuth: async () => {
      try {
        const result = await window.api.dolphinProfiles.refreshAuth()
        set({
          dolphinProfileAuthStatus: result.auth,
          ...(result.status === 'refreshed'
            ? {
                activeDolphinProfileId: result.activeProfileId,
                dolphinProfiles: result.profiles
              }
            : {})
        })
        if (result.status === 'reconnect-required') {
          toast.error(
            translate('auto.store.slices.dolphin.profiles.d6e764e7db', 'Reconnect this profile')
          )
        } else if (result.status === 'failed') {
          toast.error(
            translate(
              'auto.store.slices.dolphin.profiles.2f6c78a039',
              'Failed to refresh profile auth'
            ),
            { description: result.error }
          )
        }
        return result
      } catch (err) {
        console.error('Failed to refresh Dolphin profile auth:', err)
        toast.error(
          translate(
            'auto.store.slices.dolphin.profiles.2f6c78a039',
            'Failed to refresh profile auth'
          ),
          {
            description: err instanceof Error ? err.message : String(err)
          }
        )
        return null
      }
    },

    signOutCurrentDolphinProfile: async () => {
      nextConnectAttempt += 1
      appliedConnectAttempt = nextConnectAttempt
      try {
        const result = await window.api.dolphinProfiles.signOutCurrent()
        set({
          activeDolphinProfileId: result.activeProfileId,
          dolphinProfiles: result.profiles,
          dolphinProfileAuthStatus: result.auth
        })
        if (result.auth.state !== 'connected') {
          toast.success(
            translate('auto.store.slices.dolphin.profiles.a37b5e6d37', 'Signed out of profile')
          )
        }
        return result
      } catch (err) {
        console.error('Failed to sign out of Dolphin profile:', err)
        toast.error(
          translate('auto.store.slices.dolphin.profiles.83600521e7', 'Failed to sign out'),
          {
            description: err instanceof Error ? err.message : String(err)
          }
        )
        return null
      }
    },

    selectDolphinProfileOrg: async (orgId) => {
      try {
        const result = await window.api.dolphinProfiles.selectOrg({ orgId })
        set({
          dolphinProfileAuthStatus: result.auth,
          ...(result.status === 'selected'
            ? {
                activeDolphinProfileId: result.activeProfileId,
                dolphinProfiles: result.profiles
              }
            : {})
        })
        if (result.status === 'reconnect-required') {
          toast.error(
            translate('auto.store.slices.dolphin.profiles.d6e764e7db', 'Reconnect this profile')
          )
        } else if (result.status === 'failed') {
          toast.error(
            translate(
              'auto.store.slices.dolphin.profiles.76deec8f58',
              'Failed to switch organization'
            ),
            { description: result.error }
          )
        }
        return result
      } catch (err) {
        console.error('Failed to switch Dolphin profile org:', err)
        toast.error(
          translate(
            'auto.store.slices.dolphin.profiles.76deec8f58',
            'Failed to switch organization'
          ),
          {
            description: err instanceof Error ? err.message : String(err)
          }
        )
        return null
      }
    }
  }
}
