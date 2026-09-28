import type { StateCreator } from 'zustand'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type {
  DolphinProfileAuthStatus,
  DolphinProfileSummary,
  SwitchDolphinProfileResult,
  TransferDolphinProfileProjectArgs,
  TransferDolphinProfileProjectResult
} from '../../../../shared/dolphin-profiles'
import type { AppState } from '../types'
import {
  createDolphinProfilesAuthActions,
  type DolphinProfilesAuthActions
} from './dolphin-profiles-auth-actions'

export type DolphinProfilesSlice = DolphinProfilesAuthActions & {
  dolphinProfiles: DolphinProfileSummary[]
  activeDolphinProfileId: string | null
  dolphinProfileAuthStatus: DolphinProfileAuthStatus | null
  dolphinProfilesMultiProfileUi: boolean
  dolphinProfilesLoading: boolean
  dolphinProfileSwitching: boolean
  fetchDolphinProfiles: () => Promise<void>
  fetchDolphinProfileAuthStatus: () => Promise<DolphinProfileAuthStatus | null>
  createLocalDolphinProfile: (name?: string) => Promise<DolphinProfileSummary | null>
  switchDolphinProfile: (profileId: string) => Promise<SwitchDolphinProfileResult | null>
  transferDolphinProfileProject: (
    args: TransferDolphinProfileProjectArgs
  ) => Promise<TransferDolphinProfileProjectResult | null>
}

export const createDolphinProfilesSlice: StateCreator<AppState, [], [], DolphinProfilesSlice> = (
  set,
  get,
  api
) => ({
  dolphinProfiles: [],
  activeDolphinProfileId: null,
  dolphinProfileAuthStatus: null,
  dolphinProfilesMultiProfileUi: false,
  dolphinProfilesLoading: false,
  dolphinProfileSwitching: false,

  fetchDolphinProfiles: async () => {
    set({ dolphinProfilesLoading: true })
    try {
      const [state, authStatus] = await Promise.all([
        window.api.dolphinProfiles.list(),
        window.api.dolphinProfiles.authStatus()
      ])
      set({
        activeDolphinProfileId: state.activeProfileId,
        dolphinProfiles: state.profiles,
        dolphinProfilesMultiProfileUi: state.multiProfileUi,
        dolphinProfileAuthStatus: authStatus,
        dolphinProfilesLoading: false
      })
    } catch (err) {
      console.error('Failed to fetch Dolphin profiles:', err)
      set({ dolphinProfilesLoading: false })
    }
  },

  fetchDolphinProfileAuthStatus: async () => {
    try {
      const authStatus = await window.api.dolphinProfiles.authStatus()
      set({ dolphinProfileAuthStatus: authStatus })
      return authStatus
    } catch (err) {
      console.error('Failed to fetch Dolphin profile auth status:', err)
      return null
    }
  },

  createLocalDolphinProfile: async (name) => {
    try {
      const state = await window.api.dolphinProfiles.createLocal({ name })
      set({
        activeDolphinProfileId: state.activeProfileId,
        dolphinProfiles: state.profiles
      })
      void get().fetchDolphinProfileAuthStatus()
      return state.profile
    } catch (err) {
      console.error('Failed to create Dolphin profile:', err)
      toast.error(
        translate('auto.store.slices.dolphin.profiles.612f7f6861', 'Failed to create profile'),
        {
          description: err instanceof Error ? err.message : String(err)
        }
      )
      return null
    }
  },

  ...createDolphinProfilesAuthActions(set, get, api),

  switchDolphinProfile: async (profileId) => {
    if (!profileId || profileId === get().activeDolphinProfileId) {
      return { status: 'already-active' }
    }
    set({ dolphinProfileSwitching: true })
    try {
      const result = await window.api.dolphinProfiles.switchProfile({ profileId })
      if (result?.status !== 'relaunching') {
        // Why: only a relaunch may keep the switcher locked; a stale
        // "already-active" answer would otherwise disable it forever.
        set({ dolphinProfileSwitching: false })
      }
      return result
    } catch (err) {
      console.error('Failed to switch Dolphin profile:', err)
      set({ dolphinProfileSwitching: false })
      toast.error(
        translate('auto.store.slices.dolphin.profiles.7d4bc516ee', 'Failed to switch profile'),
        {
          description: err instanceof Error ? err.message : String(err)
        }
      )
      return null
    }
  },

  transferDolphinProfileProject: async (args) => {
    try {
      const result = await window.api.dolphinProfiles.transferProject(args)
      if (result.status === 'duplicate-target') {
        toast.error(
          translate(
            'auto.store.slices.dolphin.profiles.f518e89aa5',
            'Project already exists in that profile'
          )
        )
      }
      if (result.status === 'transferred' && result.willRelaunch) {
        set({ dolphinProfileSwitching: true })
      }
      return result
    } catch (err) {
      console.error('Failed to transfer Dolphin profile project:', err)
      toast.error(
        translate('auto.store.slices.dolphin.profiles.f03ae7f27b', 'Failed to transfer project'),
        {
          description: err instanceof Error ? err.message : String(err)
        }
      )
      return null
    }
  }
})
