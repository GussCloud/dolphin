import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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
  app: {
    getPath: () => userDataPath
  },
  safeStorage: safeStorageMock
}))

vi.mock('./profile-cloud-pkce', () => ({
  beginDolphinCloudPkceFlow: beginDolphinCloudPkceFlowMock
}))

vi.mock('./profile-cloud-client', () => ({
  createDolphinCloudProfile: vi.fn(),
  exchangeDolphinCloudAuthCode: exchangeDolphinCloudAuthCodeMock,
  refreshDolphinCloudCapabilities: vi.fn(),
  refreshDolphinCloudSession: vi.fn(),
  revokeDolphinCloudSession: revokeDolphinCloudSessionMock,
  selectDolphinCloudOrg: vi.fn()
}))

import {
  connectCurrentDolphinProfile,
  createCloudLinkedDolphinProfile,
  getCurrentDolphinProfileAuthStatus,
  selectCurrentDolphinProfileOrg,
  signOutCurrentDolphinProfile
} from './profile-cloud-service'

describe('Dolphin cloud dev auth service', () => {
  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'dolphin-cloud-dev-auth-'))
    beginDolphinCloudPkceFlowMock.mockReset()
    exchangeDolphinCloudAuthCodeMock.mockReset()
    revokeDolphinCloudSessionMock.mockReset()
    safeStorageMock.decryptString.mockReset()
    safeStorageMock.encryptString.mockReset()
    safeStorageMock.isEncryptionAvailable.mockReset()
    safeStorageMock.decryptString.mockImplementation((value: Buffer) => value.toString('utf-8'))
    safeStorageMock.encryptString.mockImplementation((value: string) => Buffer.from(value, 'utf-8'))
    safeStorageMock.isEncryptionAvailable.mockReturnValue(true)
    vi.unstubAllEnvs()
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('DOLPHIN_CLOUD_DEV_AUTH', '1')
    vi.stubEnv('DOLPHIN_CLOUD_API_URL', '')
    vi.stubEnv('DOLPHIN_CLOUD_CLIENT_ID', '')
  })

  afterEach(() => {
    rmSync(userDataPath, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('connects the active profile without PKCE or cloud endpoints', async () => {
    expect(getCurrentDolphinProfileAuthStatus(userDataPath)).toMatchObject({
      configured: true,
      state: 'local'
    })

    const result = await connectCurrentDolphinProfile(userDataPath)

    expect(result.status).toBe('connected')
    expect(beginDolphinCloudPkceFlowMock).not.toHaveBeenCalled()
    expect(exchangeDolphinCloudAuthCodeMock).not.toHaveBeenCalled()
    expect(getCurrentDolphinProfileAuthStatus(userDataPath)).toMatchObject({
      configured: true,
      state: 'connected',
      persistence: 'encrypted',
      cloud: {
        cloudProfileId: 'dev-cloud-local-default',
        email: 'dev@dolphin.local'
      },
      capabilities: {
        flags: expect.objectContaining({ 'share.create': true })
      }
    })
    expect(getCurrentDolphinProfileAuthStatus(userDataPath).organizations).toHaveLength(2)
  })

  it('selects dev organizations and creates org-scoped cloud profiles locally', async () => {
    await connectCurrentDolphinProfile(userDataPath)

    const selected = await selectCurrentDolphinProfileOrg(userDataPath, 'dev-acme')
    const created = await createCloudLinkedDolphinProfile(userDataPath, {
      orgId: 'dev-acme',
      name: 'Acme Dev'
    })

    expect(selected.status).toBe('selected')
    expect(getCurrentDolphinProfileAuthStatus(userDataPath).cloud).toMatchObject({
      activeOrgId: 'dev-acme',
      activeOrgName: 'Acme Dev'
    })
    expect(created.status).toBe('created')
    if (created.status === 'created') {
      expect(created.profile).toMatchObject({
        name: 'Acme Dev',
        kind: 'cloud-linked',
        cloud: expect.objectContaining({
          activeOrgId: 'dev-acme',
          activeOrgName: 'Acme Dev'
        })
      })
    }
  })

  it('signs out locally without calling the cloud logout endpoint', async () => {
    await connectCurrentDolphinProfile(userDataPath)

    const result = await signOutCurrentDolphinProfile(userDataPath)

    expect(result.status).toBe('signed-out')
    expect(revokeDolphinCloudSessionMock).not.toHaveBeenCalled()
    expect(getCurrentDolphinProfileAuthStatus(userDataPath)).toMatchObject({
      configured: true,
      state: 'local',
      persistence: 'none'
    })
  })
})
