import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  ConnectCurrentDolphinProfileResult,
  CreateCloudLinkedDolphinProfileResult,
  DolphinProfileAuthStatus,
  DolphinProfileListState,
  RefreshCurrentDolphinProfileAuthResult,
  SelectDolphinProfileOrgResult,
  SignOutCurrentDolphinProfileResult
} from '../../../../shared/dolphin-profiles'
import { createTestStore } from './store-test-helpers'

const { toastErrorMock, toastSuccessMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn()
}))

vi.mock('sonner', () => ({
  toast: {
    error: toastErrorMock,
    info: vi.fn(),
    success: toastSuccessMock,
    warning: vi.fn()
  }
}))

const listState: DolphinProfileListState = {
  activeProfileId: 'local-default',
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

const localAuthStatus: DolphinProfileAuthStatus = {
  activeProfileId: 'local-default',
  configured: false,
  state: 'unconfigured',
  persistence: 'none'
}

const connectedCloud = {
  cloudProfileId: 'cloud-profile-1',
  userId: 'user-1',
  email: 'nina@example.com',
  linkedAt: 3
}

const connectedOrganizations = [
  { orgId: 'org-1', name: 'Acme', role: 'Admin' },
  { orgId: 'org-2', name: 'Personal' }
]

const connectedAuthStatus: DolphinProfileAuthStatus = {
  activeProfileId: 'local-default',
  configured: true,
  state: 'connected',
  persistence: 'encrypted',
  cloud: connectedCloud,
  organizations: connectedOrganizations,
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

describe('dolphin profile auth actions slice', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    toastErrorMock.mockReset()
    toastSuccessMock.mockReset()
    dolphinProfilesApi.authStatus.mockResolvedValue(localAuthStatus)
    vi.stubGlobal('window', {
      api: {
        dolphinProfiles: dolphinProfilesApi
      }
    })
  })

  it('connects the current profile and stores returned cloud metadata', async () => {
    const connectedProfiles = [
      {
        ...listState.profiles[0],
        kind: 'cloud-linked' as const,
        cloud: connectedAuthStatus.cloud
      }
    ]
    const result: ConnectCurrentDolphinProfileResult = {
      status: 'connected',
      auth: connectedAuthStatus,
      activeProfileId: 'local-default',
      profiles: connectedProfiles
    }
    dolphinProfilesApi.connectCurrent.mockResolvedValue(result)
    const store = createTestStore()

    await expect(store.getState().connectCurrentDolphinProfile()).resolves.toEqual(result)
    expect(store.getState().dolphinProfileAuthStatus).toEqual(connectedAuthStatus)
    expect(store.getState().dolphinProfiles).toEqual(connectedProfiles)
    expect(toastSuccessMock).toHaveBeenCalledOnce()
  })

  it('starts a second sign-in while the first browser wait is still open', async () => {
    const connectedProfiles = [
      {
        ...listState.profiles[0],
        kind: 'cloud-linked' as const,
        cloud: connectedAuthStatus.cloud
      }
    ]
    const connected: ConnectCurrentDolphinProfileResult = {
      status: 'connected',
      auth: connectedAuthStatus,
      activeProfileId: 'local-default',
      profiles: connectedProfiles
    }
    const cancelled: ConnectCurrentDolphinProfileResult = {
      status: 'cancelled',
      auth: connectedAuthStatus
    }
    let finishFirst!: (value: ConnectCurrentDolphinProfileResult) => void
    dolphinProfilesApi.connectCurrent
      .mockReturnValueOnce(
        new Promise<ConnectCurrentDolphinProfileResult>((resolve) => {
          finishFirst = resolve
        })
      )
      .mockResolvedValueOnce(connected)
    const store = createTestStore()

    const first = store.getState().connectCurrentDolphinProfile()
    const second = store.getState().connectCurrentDolphinProfile()

    expect(dolphinProfilesApi.connectCurrent).toHaveBeenCalledTimes(2)
    await expect(second).resolves.toEqual(connected)
    expect(toastSuccessMock).toHaveBeenCalledOnce()
    finishFirst(cancelled)
    await expect(first).resolves.toEqual(cancelled)
    expect(toastErrorMock).not.toHaveBeenCalled()
    expect(toastSuccessMock).toHaveBeenCalledOnce()
    expect(store.getState().dolphinProfileAuthStatus).toEqual(connectedAuthStatus)
  })

  it('refreshes current profile auth and stores fresh capability flags', async () => {
    const refreshedAuthStatus: DolphinProfileAuthStatus = {
      ...connectedAuthStatus,
      capabilities: {
        flags: { share: false, team: true },
        refreshedAt: 8
      }
    }
    const result: RefreshCurrentDolphinProfileAuthResult = {
      status: 'refreshed',
      auth: refreshedAuthStatus,
      activeProfileId: 'local-default',
      profiles: [
        {
          ...listState.profiles[0],
          kind: 'cloud-linked',
          cloud: refreshedAuthStatus.cloud
        }
      ]
    }
    dolphinProfilesApi.refreshAuth.mockResolvedValue(result)
    const store = createTestStore()

    await expect(store.getState().refreshCurrentDolphinProfileAuth()).resolves.toEqual(result)
    expect(dolphinProfilesApi.refreshAuth).toHaveBeenCalledOnce()
    expect(store.getState().dolphinProfileAuthStatus).toEqual(refreshedAuthStatus)
    expect(store.getState().dolphinProfiles).toEqual(result.profiles)
  })

  it('creates a cloud-linked profile and stores the returned profile list', async () => {
    const cloudProfile = {
      id: 'cloud-acme',
      name: 'Acme',
      avatar: { kind: 'initials' as const, initials: 'A', color: 'neutral' as const },
      kind: 'cloud-linked' as const,
      createdAt: 5,
      updatedAt: 5,
      lastOpenedAt: 5,
      cloud: {
        ...connectedCloud,
        cloudProfileId: 'cloud-profile-2',
        activeOrgId: 'org-1',
        activeOrgName: 'Acme'
      }
    }
    const result: CreateCloudLinkedDolphinProfileResult = {
      status: 'created',
      auth: connectedAuthStatus,
      activeProfileId: 'local-default',
      profiles: [...listState.profiles, cloudProfile],
      profile: cloudProfile
    }
    dolphinProfilesApi.createCloudLinked.mockResolvedValue(result)
    const store = createTestStore()

    await expect(
      store.getState().createCloudLinkedDolphinProfile({ orgId: 'org-1', name: 'Acme' })
    ).resolves.toEqual(result)
    expect(dolphinProfilesApi.createCloudLinked).toHaveBeenCalledWith({
      orgId: 'org-1',
      name: 'Acme'
    })
    expect(store.getState().dolphinProfiles).toEqual(result.profiles)
  })

  it('signs out the current profile without dropping local profile data', async () => {
    const result: SignOutCurrentDolphinProfileResult = {
      status: 'signed-out',
      auth: localAuthStatus,
      activeProfileId: 'local-default',
      profiles: listState.profiles
    }
    dolphinProfilesApi.signOutCurrent.mockResolvedValue(result)
    const store = createTestStore()

    await expect(store.getState().signOutCurrentDolphinProfile()).resolves.toEqual(result)
    expect(store.getState().dolphinProfileAuthStatus).toEqual(localAuthStatus)
    expect(store.getState().dolphinProfiles).toEqual(listState.profiles)
  })

  it('selects a cloud organization and refreshes auth state', async () => {
    const selectedAuthStatus: DolphinProfileAuthStatus = {
      ...connectedAuthStatus,
      cloud: {
        ...connectedCloud,
        activeOrgId: 'org-1',
        activeOrgName: 'Acme'
      }
    }
    const result: SelectDolphinProfileOrgResult = {
      status: 'selected',
      auth: selectedAuthStatus,
      activeProfileId: 'local-default',
      profiles: [
        {
          ...listState.profiles[0],
          kind: 'cloud-linked',
          cloud: selectedAuthStatus.cloud
        }
      ]
    }
    dolphinProfilesApi.selectOrg.mockResolvedValue(result)
    const store = createTestStore()

    await expect(store.getState().selectDolphinProfileOrg('org-1')).resolves.toEqual(result)
    expect(dolphinProfilesApi.selectOrg).toHaveBeenCalledWith({ orgId: 'org-1' })
    expect(store.getState().dolphinProfileAuthStatus).toEqual(selectedAuthStatus)
    expect(store.getState().dolphinProfileAuthStatus?.organizations).toEqual(connectedOrganizations)
  })
})
