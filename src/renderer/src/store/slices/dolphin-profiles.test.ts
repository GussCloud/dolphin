import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createTestStore } from './store-test-helpers'
import type {
  CreateLocalDolphinProfileResult,
  DolphinProfileAuthStatus,
  DolphinProfileListResult,
  TransferDolphinProfileProjectResult
} from '../../../../shared/dolphin-profiles'

const { toastErrorMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn()
}))

vi.mock('sonner', () => ({
  toast: {
    error: toastErrorMock,
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn()
  }
}))

const listState: DolphinProfileListResult = {
  activeProfileId: 'local-default',
  multiProfileUi: false,
  profiles: [
    {
      id: 'local-default',
      name: 'Personal',
      avatar: { kind: 'initials', initials: 'P', color: 'neutral' },
      kind: 'local',
      createdAt: 1,
      updatedAt: 1,
      lastOpenedAt: 1
    }
  ]
}

const createdState: CreateLocalDolphinProfileResult = {
  activeProfileId: 'local-default',
  profiles: [
    ...listState.profiles,
    {
      id: 'local-work',
      name: 'Work',
      avatar: { kind: 'initials', initials: 'W', color: 'neutral' },
      kind: 'local',
      createdAt: 2,
      updatedAt: 2,
      lastOpenedAt: 2
    }
  ],
  profile: {
    id: 'local-work',
    name: 'Work',
    avatar: { kind: 'initials', initials: 'W', color: 'neutral' },
    kind: 'local',
    createdAt: 2,
    updatedAt: 2,
    lastOpenedAt: 2
  }
}

const localAuthStatus: DolphinProfileAuthStatus = {
  activeProfileId: 'local-default',
  configured: false,
  state: 'unconfigured',
  persistence: 'none'
}

const connectedAuthStatus: DolphinProfileAuthStatus = {
  activeProfileId: 'local-default',
  configured: true,
  state: 'connected',
  persistence: 'encrypted',
  cloud: {
    cloudProfileId: 'cloud-profile-1',
    userId: 'user-1',
    email: 'nina@example.com',
    linkedAt: 3
  },
  capabilities: {
    flags: { share: true },
    refreshedAt: 4
  }
}

const dolphinProfilesApi = {
  list: vi.fn(),
  authStatus: vi.fn(),
  createLocal: vi.fn(),
  createCloudLinked: vi.fn(),
  connectCurrent: vi.fn(),
  refreshAuth: vi.fn(),
  signOutCurrent: vi.fn(),
  selectOrg: vi.fn(),
  switchProfile: vi.fn(),
  transferProject: vi.fn()
}

describe('dolphin profile slice', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    toastErrorMock.mockReset()
    dolphinProfilesApi.authStatus.mockResolvedValue(localAuthStatus)
    vi.stubGlobal('window', {
      api: {
        dolphinProfiles: dolphinProfilesApi
      }
    })
  })

  it('fetches profiles into store state', async () => {
    dolphinProfilesApi.list.mockResolvedValue(listState)
    const store = createTestStore()

    await store.getState().fetchDolphinProfiles()

    expect(store.getState().activeDolphinProfileId).toBe('local-default')
    expect(store.getState().dolphinProfiles).toEqual(listState.profiles)
    expect(store.getState().dolphinProfileAuthStatus).toEqual(localAuthStatus)
    expect(store.getState().dolphinProfilesMultiProfileUi).toBe(false)
    expect(store.getState().dolphinProfilesLoading).toBe(false)
  })

  it('stores the multi-profile UI flag from the list result', async () => {
    dolphinProfilesApi.list.mockResolvedValue({ ...listState, multiProfileUi: true })
    const store = createTestStore()

    await store.getState().fetchDolphinProfiles()

    expect(store.getState().dolphinProfilesMultiProfileUi).toBe(true)
  })

  it('creates a local profile and returns the created summary', async () => {
    dolphinProfilesApi.createLocal.mockResolvedValue(createdState)
    const store = createTestStore()

    const profile = await store.getState().createLocalDolphinProfile('Work')

    expect(profile).toEqual(createdState.profile)
    expect(dolphinProfilesApi.createLocal).toHaveBeenCalledWith({ name: 'Work' })
    expect(store.getState().dolphinProfiles).toEqual(createdState.profiles)
  })

  it('fetches auth status independently', async () => {
    dolphinProfilesApi.authStatus.mockResolvedValue(connectedAuthStatus)
    const store = createTestStore()

    await expect(store.getState().fetchDolphinProfileAuthStatus()).resolves.toEqual(
      connectedAuthStatus
    )
    expect(store.getState().dolphinProfileAuthStatus).toEqual(connectedAuthStatus)
  })

  it('sets switching state while requesting a profile switch', async () => {
    dolphinProfilesApi.switchProfile.mockResolvedValue({ status: 'relaunching' })
    const store = createTestStore()
    store.setState({ activeDolphinProfileId: 'local-default' })

    const result = await store.getState().switchDolphinProfile('local-work')

    expect(result).toEqual({ status: 'relaunching' })
    expect(dolphinProfilesApi.switchProfile).toHaveBeenCalledWith({ profileId: 'local-work' })
    expect(store.getState().dolphinProfileSwitching).toBe(true)
  })

  it('releases switching state when main reports the profile is already active', async () => {
    // Why: a stale renderer activeDolphinProfileId must not lock the switcher
    // forever when no relaunch is actually coming.
    dolphinProfilesApi.switchProfile.mockResolvedValue({ status: 'already-active' })
    const store = createTestStore()
    store.setState({ activeDolphinProfileId: 'local-default' })

    const result = await store.getState().switchDolphinProfile('local-work')

    expect(result).toEqual({ status: 'already-active' })
    expect(store.getState().dolphinProfileSwitching).toBe(false)
  })

  it('does not call main when switching to the active profile', async () => {
    const store = createTestStore()
    store.setState({ activeDolphinProfileId: 'local-default' })

    const result = await store.getState().switchDolphinProfile('local-default')

    expect(result).toEqual({ status: 'already-active' })
    expect(dolphinProfilesApi.switchProfile).not.toHaveBeenCalled()
  })

  it('transfers projects through the profile API', async () => {
    const transferResult: TransferDolphinProfileProjectResult = {
      status: 'transferred',
      mode: 'copy',
      sourceProfileId: 'local-default',
      targetProfileId: 'local-work',
      sourceRepoId: 'repo-1',
      targetRepoId: 'repo-2',
      targetProjectId: 'repo:repo-2'
    }
    dolphinProfilesApi.transferProject.mockResolvedValue(transferResult)
    const store = createTestStore()

    const result = await store.getState().transferDolphinProfileProject({
      sourceProfileId: 'local-default',
      targetProfileId: 'local-work',
      repoId: 'repo-1',
      mode: 'copy'
    })

    expect(result).toEqual(transferResult)
    expect(dolphinProfilesApi.transferProject).toHaveBeenCalledWith({
      sourceProfileId: 'local-default',
      targetProfileId: 'local-work',
      repoId: 'repo-1',
      mode: 'copy'
    })
  })

  it('marks profile switching when a project transfer relaunches the app', async () => {
    const transferResult: TransferDolphinProfileProjectResult = {
      status: 'transferred',
      mode: 'move',
      sourceProfileId: 'local-default',
      targetProfileId: 'local-work',
      sourceRepoId: 'repo-1',
      targetRepoId: 'repo-1',
      targetProjectId: 'repo:repo-1',
      willRelaunch: true
    }
    dolphinProfilesApi.transferProject.mockResolvedValue(transferResult)
    const store = createTestStore()

    await store.getState().transferDolphinProfileProject({
      sourceProfileId: 'local-default',
      targetProfileId: 'local-work',
      repoId: 'repo-1',
      mode: 'move'
    })

    expect(store.getState().dolphinProfileSwitching).toBe(true)
  })

  it('warns when a project already exists in the target profile', async () => {
    const transferResult: TransferDolphinProfileProjectResult = {
      status: 'duplicate-target',
      sourceProfileId: 'local-default',
      targetProfileId: 'local-work',
      sourceRepoId: 'repo-1',
      duplicateRepoId: 'repo-existing'
    }
    dolphinProfilesApi.transferProject.mockResolvedValue(transferResult)
    const store = createTestStore()

    await store.getState().transferDolphinProfileProject({
      sourceProfileId: 'local-default',
      targetProfileId: 'local-work',
      repoId: 'repo-1',
      mode: 'copy'
    })

    expect(toastErrorMock).toHaveBeenCalledWith('Project already exists in that profile')
    expect(store.getState().dolphinProfileSwitching).toBe(false)
  })
})
