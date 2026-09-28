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
  refreshDolphinCloudCapabilitiesMock,
  refreshDolphinCloudSessionMock,
  selectDolphinCloudOrgMock,
  DolphinCloudRequestErrorMock,
  safeStorageMock
} = vi.hoisted(() => ({
  beginDolphinCloudPkceFlowMock: vi.fn(),
  createDolphinCloudProfileMock: vi.fn(),
  exchangeDolphinCloudAuthCodeMock: vi.fn(),
  refreshDolphinCloudCapabilitiesMock: vi.fn(),
  refreshDolphinCloudSessionMock: vi.fn(),
  selectDolphinCloudOrgMock: vi.fn(),
  DolphinCloudRequestErrorMock: class DolphinCloudRequestError extends Error {
    constructor(public readonly statusCode: number) {
      super(`dolphin_cloud_request_failed_${statusCode}`)
      this.name = 'DolphinCloudRequestError'
    }
  },
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
  DolphinCloudRequestError: DolphinCloudRequestErrorMock,
  isAmbiguousCloudRequestFailure: (error: unknown) =>
    !(error instanceof DolphinCloudRequestErrorMock),
  createDolphinCloudProfile: createDolphinCloudProfileMock,
  exchangeDolphinCloudAuthCode: exchangeDolphinCloudAuthCodeMock,
  refreshDolphinCloudCapabilities: refreshDolphinCloudCapabilitiesMock,
  refreshDolphinCloudSession: refreshDolphinCloudSessionMock,
  revokeDolphinCloudSession: vi.fn(),
  selectDolphinCloudOrg: selectDolphinCloudOrgMock
}))

import {
  connectCurrentDolphinProfile,
  createCloudLinkedDolphinProfile,
  getCurrentDolphinProfileAuthStatus,
  refreshCurrentDolphinProfileAuth,
  selectCurrentDolphinProfileOrg
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

function futureExpiresAt(): number {
  return Date.now() + 3_600_000
}

function configureCloudEnv(): void {
  vi.stubEnv('DOLPHIN_CLOUD_API_URL', 'https://dolphin-cloud.example')
  vi.stubEnv('DOLPHIN_CLOUD_CLIENT_ID', 'desktop-client')
}

function mockSuccessfulConnect(): void {
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
    expiresAt: futureExpiresAt(),
    cloud: cloudSummary,
    organizations,
    capabilities
  } satisfies DolphinCloudSessionExchangeResponse)
}

function mockSuccessfulSessionRefresh(): void {
  refreshDolphinCloudSessionMock.mockResolvedValue({
    accessToken: 'rotated-access-token',
    refreshToken: 'rotated-refresh-token',
    expiresAt: futureExpiresAt(),
    cloud: cloudSummary,
    organizations,
    capabilities
  } satisfies DolphinCloudSessionExchangeResponse)
}

describe('Dolphin cloud profile auth-failure retry', () => {
  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'dolphin-cloud-service-auth-retry-'))
    beginDolphinCloudPkceFlowMock.mockReset()
    createDolphinCloudProfileMock.mockReset()
    exchangeDolphinCloudAuthCodeMock.mockReset()
    refreshDolphinCloudCapabilitiesMock.mockReset()
    refreshDolphinCloudSessionMock.mockReset()
    selectDolphinCloudOrgMock.mockReset()
    safeStorageMock.decryptString.mockReset()
    safeStorageMock.encryptString.mockReset()
    safeStorageMock.isEncryptionAvailable.mockReset()
    safeStorageMock.decryptString.mockImplementation((value: Buffer) => value.toString('utf-8'))
    safeStorageMock.encryptString.mockImplementation((value: string) => Buffer.from(value, 'utf-8'))
    safeStorageMock.isEncryptionAvailable.mockReturnValue(true)
    vi.unstubAllEnvs()
    vi.stubEnv('DOLPHIN_CLOUD_API_URL', '')
    vi.stubEnv('DOLPHIN_CLOUD_CLIENT_ID', '')
  })

  afterEach(() => {
    rmSync(userDataPath, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('refreshes and retries cloud profile creation after an auth failure', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()
    mockSuccessfulSessionRefresh()
    await connectCurrentDolphinProfile(userDataPath)
    createDolphinCloudProfileMock
      .mockRejectedValueOnce(new DolphinCloudRequestErrorMock(401))
      .mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: futureExpiresAt(),
        cloud: { ...cloudSummary, cloudProfileId: 'cloud-profile-2' },
        organizations,
        capabilities
      } satisfies DolphinCloudSessionExchangeResponse)

    const result = await createCloudLinkedDolphinProfile(userDataPath, { name: 'Acme' })

    expect(result.status).toBe('created')
    expect(createDolphinCloudProfileMock).toHaveBeenNthCalledWith(
      2,
      expect.any(Object),
      expect.objectContaining({ accessToken: 'rotated-access-token' }),
      { name: 'Acme' }
    )
  })

  it('refreshes and retries capability refresh after an auth failure', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()
    mockSuccessfulSessionRefresh()
    await connectCurrentDolphinProfile(userDataPath)
    refreshDolphinCloudCapabilitiesMock
      .mockRejectedValueOnce(new DolphinCloudRequestErrorMock(403))
      .mockResolvedValue({
        capabilities: {
          flags: { share: false },
          refreshedAt: 26
        } satisfies DolphinCloudCapabilities
      })

    const result = await refreshCurrentDolphinProfileAuth(userDataPath)

    expect(result.status).toBe('refreshed')
    expect(refreshDolphinCloudCapabilitiesMock).toHaveBeenNthCalledWith(
      2,
      expect.any(Object),
      expect.objectContaining({ accessToken: 'rotated-access-token' })
    )
    expect(getCurrentDolphinProfileAuthStatus(userDataPath).capabilities).toEqual({
      flags: { share: false },
      refreshedAt: 26
    })
  })

  it('requires reconnect when a retried capability refresh is still unauthorized', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()
    mockSuccessfulSessionRefresh()
    await connectCurrentDolphinProfile(userDataPath)
    refreshDolphinCloudCapabilitiesMock
      .mockRejectedValueOnce(new DolphinCloudRequestErrorMock(401))
      .mockRejectedValueOnce(new DolphinCloudRequestErrorMock(401))

    const result = await refreshCurrentDolphinProfileAuth(userDataPath)

    expect(result.status).toBe('reconnect-required')
    expect(getCurrentDolphinProfileAuthStatus(userDataPath)).toMatchObject({
      state: 'reconnect-required',
      persistence: 'none',
      cloud: cloudSummary
    })
  })

  it('refreshes and retries organization selection after an auth failure', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()
    mockSuccessfulSessionRefresh()
    await connectCurrentDolphinProfile(userDataPath)
    selectDolphinCloudOrgMock
      .mockRejectedValueOnce(new DolphinCloudRequestErrorMock(401))
      .mockResolvedValue({
        cloud: { ...cloudSummary, activeOrgId: 'org-1', activeOrgName: 'Acme' },
        organizations,
        capabilities
      })

    const result = await selectCurrentDolphinProfileOrg(userDataPath, 'org-1')

    expect(result.status).toBe('selected')
    expect(selectDolphinCloudOrgMock).toHaveBeenNthCalledWith(
      2,
      expect.any(Object),
      expect.objectContaining({ accessToken: 'rotated-access-token' }),
      'org-1'
    )
  })
})
