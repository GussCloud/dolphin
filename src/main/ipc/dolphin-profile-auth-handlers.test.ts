import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  handlers,
  createCloudLinkedDolphinProfileMock,
  connectCurrentDolphinProfileMock,
  getCurrentDolphinProfileAuthStatusMock,
  refreshCurrentDolphinProfileAuthMock,
  selectCurrentDolphinProfileOrgMock,
  signOutCurrentDolphinProfileMock
} = vi.hoisted(() => ({
  handlers: new Map<string, (_event: unknown, args?: unknown) => unknown>(),
  createCloudLinkedDolphinProfileMock: vi.fn(),
  connectCurrentDolphinProfileMock: vi.fn(),
  getCurrentDolphinProfileAuthStatusMock: vi.fn(),
  refreshCurrentDolphinProfileAuthMock: vi.fn(),
  selectCurrentDolphinProfileOrgMock: vi.fn(),
  signOutCurrentDolphinProfileMock: vi.fn()
}))

vi.mock('electron', () => ({
  app: {
    exit: vi.fn(),
    relaunch: vi.fn()
  },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (_event: unknown, args?: unknown) => unknown) => {
      handlers.set(channel, handler)
    })
  }
}))

vi.mock('../tray/system-tray', () => ({
  destroySystemTray: vi.fn()
}))

vi.mock('../dolphin-profiles/profile-index-store', () => ({
  createLocalDolphinProfile: vi.fn(),
  getDolphinProfileListState: vi.fn(),
  seedNewDolphinProfileTelemetryConsent: vi.fn(),
  setActiveDolphinProfile: vi.fn()
}))

vi.mock('../dolphin-profiles/profile-project-transfer', () => ({
  transferDolphinProfileProject: vi.fn()
}))

vi.mock('../dolphin-profiles/profile-cloud-service', () => ({
  createCloudLinkedDolphinProfile: createCloudLinkedDolphinProfileMock,
  connectCurrentDolphinProfile: connectCurrentDolphinProfileMock,
  getCurrentDolphinProfileAuthStatus: getCurrentDolphinProfileAuthStatusMock,
  refreshCurrentDolphinProfileAuth: refreshCurrentDolphinProfileAuthMock,
  selectCurrentDolphinProfileOrg: selectCurrentDolphinProfileOrgMock,
  signOutCurrentDolphinProfile: signOutCurrentDolphinProfileMock
}))

import { registerDolphinProfileHandlers } from './dolphin-profiles'
import { installFakeAppEnvironment } from '../../../config/scripts/vitest-host-ports-setup'

describe('registerDolphinProfileHandlers auth channels', () => {
  beforeEach(() => {
    // Why the port and per-test: userData resolves through AppEnvironment now, and
    // the global setup's beforeEach reinstates its own fake before this runs.
    installFakeAppEnvironment({ getPath: () => '/tmp/dolphin-user-data' })
    handlers.clear()
    createCloudLinkedDolphinProfileMock.mockReset()
    connectCurrentDolphinProfileMock.mockReset()
    getCurrentDolphinProfileAuthStatusMock.mockReset()
    refreshCurrentDolphinProfileAuthMock.mockReset()
    selectCurrentDolphinProfileOrgMock.mockReset()
    signOutCurrentDolphinProfileMock.mockReset()
  })

  it('returns auth status for the current profile', async () => {
    const status = {
      activeProfileId: 'local-default',
      configured: false,
      state: 'unconfigured',
      persistence: 'none'
    }
    getCurrentDolphinProfileAuthStatusMock.mockReturnValue(status)
    registerDolphinProfileHandlers({
      flush: vi.fn(),
      freezeWrites: vi.fn(),
      getSettings: () => ({})
    } as never)

    await expect(Promise.resolve(handlers.get('dolphinProfiles:authStatus')?.(null))).resolves.toBe(
      status
    )
    expect(getCurrentDolphinProfileAuthStatusMock).toHaveBeenCalledWith('/tmp/dolphin-user-data')
  })

  it('connects and signs out the current profile through the cloud service', async () => {
    const connectResult = { status: 'unconfigured', auth: { activeProfileId: 'local-default' } }
    const signOutResult = { status: 'signed-out', auth: { activeProfileId: 'local-default' } }
    connectCurrentDolphinProfileMock.mockResolvedValue(connectResult)
    signOutCurrentDolphinProfileMock.mockResolvedValue(signOutResult)
    registerDolphinProfileHandlers({
      flush: vi.fn(),
      freezeWrites: vi.fn(),
      getSettings: () => ({})
    } as never)

    await expect(
      Promise.resolve(handlers.get('dolphinProfiles:connectCurrent')?.(null))
    ).resolves.toBe(connectResult)
    await expect(
      Promise.resolve(handlers.get('dolphinProfiles:signOutCurrent')?.(null))
    ).resolves.toBe(signOutResult)
    expect(connectCurrentDolphinProfileMock).toHaveBeenCalledWith('/tmp/dolphin-user-data')
    expect(signOutCurrentDolphinProfileMock).toHaveBeenCalledWith('/tmp/dolphin-user-data')
  })

  it('refreshes profile auth through the cloud service', async () => {
    const refreshResult = { status: 'refreshed', auth: { activeProfileId: 'local-default' } }
    refreshCurrentDolphinProfileAuthMock.mockResolvedValue(refreshResult)
    registerDolphinProfileHandlers({
      flush: vi.fn(),
      freezeWrites: vi.fn(),
      getSettings: () => ({})
    } as never)

    await expect(
      Promise.resolve(handlers.get('dolphinProfiles:refreshAuth')?.(null))
    ).resolves.toBe(refreshResult)
    expect(refreshCurrentDolphinProfileAuthMock).toHaveBeenCalledWith('/tmp/dolphin-user-data')
  })

  it('validates organization selection before calling the cloud service', async () => {
    const selectResult = { status: 'selected', auth: { activeProfileId: 'local-default' } }
    selectCurrentDolphinProfileOrgMock.mockResolvedValue(selectResult)
    registerDolphinProfileHandlers({
      flush: vi.fn(),
      freezeWrites: vi.fn(),
      getSettings: () => ({})
    } as never)

    await expect(
      Promise.resolve(handlers.get('dolphinProfiles:selectOrg')?.(null, { orgId: ' org-1 ' }))
    ).resolves.toBe(selectResult)
    expect(selectCurrentDolphinProfileOrgMock).toHaveBeenCalledWith(
      '/tmp/dolphin-user-data',
      'org-1'
    )

    await expect(
      Promise.resolve(handlers.get('dolphinProfiles:selectOrg')?.(null, { orgId: ' ' }))
    ).rejects.toThrow('invalid_dolphin_profile_org_selection')
  })

  it('creates cloud-linked profiles with trimmed optional args', async () => {
    const createResult = {
      status: 'created',
      auth: { activeProfileId: 'local-default' },
      activeProfileId: 'local-default',
      profiles: [],
      profile: { id: 'cloud-1' }
    }
    createCloudLinkedDolphinProfileMock.mockResolvedValue(createResult)
    registerDolphinProfileHandlers({
      flush: vi.fn(),
      freezeWrites: vi.fn(),
      getSettings: () => ({})
    } as never)

    await expect(
      Promise.resolve(
        handlers.get('dolphinProfiles:createCloudLinked')?.(null, {
          orgId: ' org-1 ',
          name: ' Acme '
        })
      )
    ).resolves.toBe(createResult)
    expect(createCloudLinkedDolphinProfileMock).toHaveBeenCalledWith('/tmp/dolphin-user-data', {
      orgId: 'org-1',
      name: 'Acme'
    })
  })
})
