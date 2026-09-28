import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type {
  DolphinCloudCapabilities,
  DolphinCloudOrgSummary,
  DolphinProfileCloudSummary
} from '../../shared/dolphin-profiles'
import type { DolphinCloudSessionExchangeResponse } from './profile-cloud-session-exchange'

const {
  beginDolphinCloudPkceFlowMock,
  createDolphinCloudProfileMock,
  exchangeDolphinCloudAuthCodeMock,
  revokeDolphinCloudSessionMock,
  selectDolphinCloudOrgMock,
  safeStorageMock
} = vi.hoisted(() => ({
  beginDolphinCloudPkceFlowMock: vi.fn(),
  createDolphinCloudProfileMock: vi.fn(),
  exchangeDolphinCloudAuthCodeMock: vi.fn(),
  revokeDolphinCloudSessionMock: vi.fn(),
  selectDolphinCloudOrgMock: vi.fn(),
  safeStorageMock: {
    decryptString: vi.fn((value: Buffer) => value.toString('utf-8')),
    encryptString: vi.fn((value: string) => Buffer.from(value, 'utf-8')),
    isEncryptionAvailable: vi.fn(() => true)
  }
}))

let userDataPath = ''

vi.mock('electron', () => ({
  app: {
    getPath: () => userDataPath
  },
  safeStorage: safeStorageMock
}))

vi.mock('./profile-cloud-pkce', () => ({
  beginDolphinCloudPkceFlow: beginDolphinCloudPkceFlowMock
}))

vi.mock('./profile-cloud-client', () => ({
  createDolphinCloudProfile: createDolphinCloudProfileMock,
  exchangeDolphinCloudAuthCode: exchangeDolphinCloudAuthCodeMock,
  revokeDolphinCloudSession: revokeDolphinCloudSessionMock,
  selectDolphinCloudOrg: selectDolphinCloudOrgMock
}))

import {
  connectCurrentDolphinProfile,
  createCloudLinkedDolphinProfile,
  getCurrentDolphinProfileAuthStatus,
  selectCurrentDolphinProfileOrg,
  signOutCurrentDolphinProfile
} from './profile-cloud-service'

const cloudSummary: DolphinProfileCloudSummary = {
  cloudProfileId: 'cloud-profile-1',
  userId: 'user-1',
  email: 'nina@example.com',
  displayName: 'Nina',
  linkedAt: 10
}

const capabilities: DolphinCloudCapabilities = {
  flags: { share: true },
  refreshedAt: 11
}

const organizations: DolphinCloudOrgSummary[] = [
  { orgId: 'org-1', name: 'Acme', role: 'Admin' },
  { orgId: 'org-2', name: 'Personal' }
]

function configureCloudEnv(): void {
  vi.stubEnv('DOLPHIN_CLOUD_API_URL', 'https://dolphin-cloud.example')
  vi.stubEnv('DOLPHIN_CLOUD_CLIENT_ID', 'desktop-client')
}

function futureExpiresAt(): number {
  return Date.now() + 3_600_000
}

function mockSuccessfulConnect(expiresAt = futureExpiresAt()): void {
  beginDolphinCloudPkceFlowMock.mockResolvedValue({
    code: 'auth-code',
    codeVerifier: 'code-verifier',
    nonce: 'nonce',
    redirectUri: 'http://127.0.0.1:4100/auth/callback',
    state: 'state'
  })
  exchangeDolphinCloudAuthCodeMock.mockResolvedValue({
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresAt,
    cloud: cloudSummary,
    organizations,
    capabilities
  } satisfies DolphinCloudSessionExchangeResponse)
}

describe('Dolphin cloud profile service', () => {
  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'dolphin-cloud-service-'))
    beginDolphinCloudPkceFlowMock.mockReset()
    createDolphinCloudProfileMock.mockReset()
    exchangeDolphinCloudAuthCodeMock.mockReset()
    revokeDolphinCloudSessionMock.mockReset()
    selectDolphinCloudOrgMock.mockReset()
    safeStorageMock.decryptString.mockReset()
    safeStorageMock.encryptString.mockReset()
    safeStorageMock.isEncryptionAvailable.mockReset()
    safeStorageMock.decryptString.mockImplementation((value: Buffer) => value.toString('utf-8'))
    safeStorageMock.encryptString.mockImplementation((value: string) => Buffer.from(value, 'utf-8'))
    safeStorageMock.isEncryptionAvailable.mockReturnValue(true)
    revokeDolphinCloudSessionMock.mockResolvedValue(undefined)
    vi.unstubAllEnvs()
    vi.stubEnv('DOLPHIN_CLOUD_API_URL', '')
    vi.stubEnv('DOLPHIN_CLOUD_CLIENT_ID', '')
  })

  afterEach(() => {
    rmSync(userDataPath, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('reports local unconfigured auth without cloud setup', () => {
    expect(getCurrentDolphinProfileAuthStatus(userDataPath)).toMatchObject({
      activeProfileId: 'local-default',
      configured: false,
      state: 'unconfigured',
      persistence: 'none'
    })
  })

  it('connects the active local profile without replacing its local profile ID', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()

    const result = await connectCurrentDolphinProfile(userDataPath)

    if (result.status !== 'connected') {
      throw new Error(`Expected connected result, got ${result.status}`)
    }
    expect(result.activeProfileId).toBe('local-default')
    expect(result.profiles[0]).toMatchObject({
      id: 'local-default',
      kind: 'cloud-linked',
      cloud: cloudSummary
    })
    expect(exchangeDolphinCloudAuthCodeMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ localProfileId: 'local-default', nonce: 'nonce' })
    )
    expect(getCurrentDolphinProfileAuthStatus(userDataPath)).toMatchObject({
      state: 'connected',
      persistence: 'encrypted',
      cloud: cloudSummary,
      organizations,
      capabilities
    })
  })

  it('treats provider-denied sign-in as a cancelled connect attempt', async () => {
    configureCloudEnv()
    beginDolphinCloudPkceFlowMock.mockRejectedValue(new Error('dolphin_cloud_auth_denied'))

    const result = await connectCurrentDolphinProfile(userDataPath)

    expect(result.status).toBe('cancelled')
    expect(exchangeDolphinCloudAuthCodeMock).not.toHaveBeenCalled()
    expect(getCurrentDolphinProfileAuthStatus(userDataPath)).toMatchObject({
      state: 'local',
      persistence: 'none'
    })
  })

  it('reports callback failures as failed instead of cancelled', async () => {
    configureCloudEnv()
    beginDolphinCloudPkceFlowMock.mockRejectedValue(new Error('dolphin_cloud_auth_callback_failed'))

    const result = await connectCurrentDolphinProfile(userDataPath)

    expect(result).toMatchObject({ status: 'failed', error: 'dolphin_cloud_auth_callback_failed' })
    expect(exchangeDolphinCloudAuthCodeMock).not.toHaveBeenCalled()
    expect(getCurrentDolphinProfileAuthStatus(userDataPath)).toMatchObject({ state: 'local' })
  })

  it('does not report a saved cloud session as connected when cloud config is unavailable', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()
    await connectCurrentDolphinProfile(userDataPath)
    vi.stubEnv('DOLPHIN_CLOUD_API_URL', '')
    vi.stubEnv('DOLPHIN_CLOUD_CLIENT_ID', '')

    expect(getCurrentDolphinProfileAuthStatus(userDataPath)).toMatchObject({
      configured: false,
      state: 'unconfigured',
      persistence: 'encrypted',
      cloud: cloudSummary,
      setupMessage: 'Dolphin Cloud sign-in is not configured for this build.'
    })
    expect(getCurrentDolphinProfileAuthStatus(userDataPath).organizations).toBeUndefined()
    expect(getCurrentDolphinProfileAuthStatus(userDataPath).capabilities).toBeUndefined()
  })

  it('signs out by removing cloud metadata while keeping the local profile', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()
    await connectCurrentDolphinProfile(userDataPath)

    const result = await signOutCurrentDolphinProfile(userDataPath)

    expect(result.status).toBe('signed-out')
    expect(result.activeProfileId).toBe('local-default')
    expect(result.profiles[0]).toMatchObject({ id: 'local-default', kind: 'local' })
    expect(result.profiles[0]?.cloud).toBeUndefined()
    expect(getCurrentDolphinProfileAuthStatus(userDataPath)).toMatchObject({
      state: 'local',
      persistence: 'none'
    })
    expect(revokeDolphinCloudSessionMock).toHaveBeenCalledOnce()
  })

  it('creates a new empty cloud-linked profile with its own cloud session', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()
    await connectCurrentDolphinProfile(userDataPath)
    createDolphinCloudProfileMock.mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresAt: 1000,
      cloud: {
        ...cloudSummary,
        cloudProfileId: 'cloud-profile-2',
        activeOrgId: 'org-1',
        activeOrgName: 'Acme'
      },
      organizations,
      capabilities: { flags: { share: true, team: true }, refreshedAt: 13 }
    } satisfies DolphinCloudSessionExchangeResponse)

    const result = await createCloudLinkedDolphinProfile(userDataPath, {
      orgId: 'org-1',
      name: 'Acme'
    })

    if (result.status !== 'created') {
      throw new Error(`Expected created result, got ${result.status}`)
    }
    expect(result.profile).toMatchObject({
      id: expect.stringMatching(/^cloud-/),
      name: 'Acme',
      kind: 'cloud-linked',
      cloud: expect.objectContaining({ cloudProfileId: 'cloud-profile-2' })
    })
    expect(createDolphinCloudProfileMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ accessToken: 'access-token' }),
      { orgId: 'org-1', name: 'Acme' }
    )
  })

  it('selects an organization for a connected profile', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()
    await connectCurrentDolphinProfile(userDataPath)
    const orgCloudSummary = {
      ...cloudSummary,
      activeOrgId: 'org-1',
      activeOrgName: 'Acme'
    }
    selectDolphinCloudOrgMock.mockResolvedValue({
      cloud: orgCloudSummary,
      organizations,
      capabilities: { flags: { share: true, sso: true }, refreshedAt: 12 }
    })

    const result = await selectCurrentDolphinProfileOrg(userDataPath, 'org-1')

    expect(result.status).toBe('selected')
    expect(selectDolphinCloudOrgMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ accessToken: 'access-token' }),
      'org-1'
    )
    expect(getCurrentDolphinProfileAuthStatus(userDataPath).cloud).toMatchObject({
      activeOrgId: 'org-1',
      activeOrgName: 'Acme'
    })
    expect(getCurrentDolphinProfileAuthStatus(userDataPath).organizations).toEqual(organizations)
  })
})
