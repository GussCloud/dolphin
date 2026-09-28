import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type {
  DolphinCloudCapabilities,
  DolphinCloudOrgSummary,
  DolphinProfileCloudSummary
} from '../../shared/dolphin-profiles'

const {
  beginDolphinCloudPkceFlowMock,
  exchangeDolphinCloudAuthCodeMock,
  revokeDolphinCloudSessionMock,
  safeStorageMock
} = vi.hoisted(() => ({
  beginDolphinCloudPkceFlowMock: vi.fn(),
  exchangeDolphinCloudAuthCodeMock: vi.fn(),
  revokeDolphinCloudSessionMock: vi.fn(),
  safeStorageMock: {
    decryptString: vi.fn((value: Buffer) => value.toString('utf-8')),
    encryptString: vi.fn((value: string) => Buffer.from(value, 'utf-8')),
    isEncryptionAvailable: vi.fn(() => true)
  }
}))

let userDataPath = ''

vi.mock('electron', () => ({
  app: { getPath: () => userDataPath },
  safeStorage: safeStorageMock
}))

vi.mock('./profile-cloud-pkce', () => ({
  beginDolphinCloudPkceFlow: beginDolphinCloudPkceFlowMock
}))

vi.mock('./profile-cloud-client', () => ({
  createDolphinCloudProfile: vi.fn(),
  exchangeDolphinCloudAuthCode: exchangeDolphinCloudAuthCodeMock,
  revokeDolphinCloudSession: revokeDolphinCloudSessionMock,
  selectDolphinCloudOrg: vi.fn()
}))

import {
  connectCurrentDolphinProfile,
  getCurrentDolphinProfileAuthStatus,
  signOutCurrentDolphinProfile
} from './profile-cloud-service'

const cloud: DolphinProfileCloudSummary = {
  cloudProfileId: 'cloud-profile-1',
  userId: 'user-1',
  email: 'nina@example.com',
  displayName: 'Nina',
  linkedAt: 10
}

const laterCloud: DolphinProfileCloudSummary = {
  ...cloud,
  cloudProfileId: 'cloud-profile-2',
  email: 'ada@example.com'
}

const capabilities: DolphinCloudCapabilities = { flags: { share: true }, refreshedAt: 11 }
const organizations: DolphinCloudOrgSummary[] = [{ orgId: 'org-1', name: 'Acme', role: 'Admin' }]

describe('Dolphin cloud sign-out vs newer connect', () => {
  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'dolphin-cloud-sign-out-connect-'))
    beginDolphinCloudPkceFlowMock.mockReset()
    exchangeDolphinCloudAuthCodeMock.mockReset()
    revokeDolphinCloudSessionMock.mockReset()
    safeStorageMock.decryptString.mockReset()
    safeStorageMock.encryptString.mockReset()
    safeStorageMock.isEncryptionAvailable.mockReset()
    safeStorageMock.decryptString.mockImplementation((value: Buffer) => value.toString('utf-8'))
    safeStorageMock.encryptString.mockImplementation((value: string) => Buffer.from(value, 'utf-8'))
    safeStorageMock.isEncryptionAvailable.mockReturnValue(true)
    vi.stubEnv('DOLPHIN_CLOUD_API_URL', 'https://dolphin-cloud.example')
    vi.stubEnv('DOLPHIN_CLOUD_CLIENT_ID', 'desktop-client')
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
      expiresAt: Date.now() + 3_600_000,
      cloud,
      organizations,
      capabilities
    })
  })

  afterEach(() => {
    rmSync(userDataPath, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('keeps a newer connect that finishes while sign-out is still revoking', async () => {
    await expect(connectCurrentDolphinProfile(userDataPath)).resolves.toMatchObject({
      status: 'connected'
    })
    let finishRevoke!: () => void
    revokeDolphinCloudSessionMock.mockReturnValue(
      new Promise<void>((resolve) => {
        finishRevoke = resolve
      })
    )
    const signingOut = signOutCurrentDolphinProfile(userDataPath)
    exchangeDolphinCloudAuthCodeMock.mockResolvedValue({
      accessToken: 'later-access',
      refreshToken: 'later-refresh',
      expiresAt: Date.now() + 3_600_000,
      cloud: laterCloud,
      organizations,
      capabilities
    })
    await expect(connectCurrentDolphinProfile(userDataPath)).resolves.toMatchObject({
      status: 'connected'
    })
    expect(getCurrentDolphinProfileAuthStatus(userDataPath).cloud?.email).toBe('ada@example.com')
    finishRevoke()
    await expect(signingOut).resolves.toMatchObject({ status: 'signed-out' })
    expect(getCurrentDolphinProfileAuthStatus(userDataPath)).toMatchObject({
      state: 'connected',
      cloud: { email: 'ada@example.com' }
    })
  })
})
