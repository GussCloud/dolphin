import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type {
  DolphinCloudCapabilities,
  DolphinCloudOrgSummary,
  DolphinProfileCloudSummary
} from '../../shared/dolphin-profiles'

const mocks = vi.hoisted(() => ({
  beginPkce: vi.fn(),
  exchangeCode: vi.fn(),
  revoke: vi.fn(),
  azureDevOpsSignIn: vi.fn(),
  safeStorage: {
    decryptString: vi.fn((value: Buffer) => value.toString('utf-8')),
    encryptString: vi.fn((value: string) => Buffer.from(value, 'utf-8')),
    isEncryptionAvailable: vi.fn(() => true)
  }
}))

let userDataPath = ''

vi.mock('electron', () => ({
  app: { getPath: () => userDataPath },
  safeStorage: mocks.safeStorage
}))
vi.mock('./profile-cloud-pkce', () => ({ beginDolphinCloudPkceFlow: mocks.beginPkce }))
vi.mock('./profile-cloud-client', () => ({
  createDolphinCloudProfile: vi.fn(),
  exchangeDolphinCloudAuthCode: mocks.exchangeCode,
  revokeDolphinCloudSession: mocks.revoke,
  selectDolphinCloudOrg: vi.fn()
}))
vi.mock('./profile-cloud-azure-devops-sign-in-client', () => ({
  signInToDolphinCloudWithAzureDevOps: mocks.azureDevOpsSignIn
}))

import { getDolphinCloudAuthConfig, type DolphinCloudAuthConfig } from './profile-cloud-auth-config'
import { signInCurrentDolphinProfileWithAzureDevOps } from './profile-cloud-azure-devops-sign-in'
import { _resetCloudConnectAttemptsForTests } from './profile-cloud-connect-attempts'
import {
  connectCurrentDolphinProfile,
  getCurrentDolphinProfileAuthStatus,
  signOutCurrentDolphinProfile
} from './profile-cloud-service'
import { readDolphinCloudSession } from './profile-cloud-session-store'
import { onDolphinCloudSignedIn } from './profile-cloud-sign-in-events'
import { hasDolphinCloudExplicitSignOut } from './profile-cloud-sign-out-marker'
import { ensureActiveDolphinProfile } from './profile-index-store'

const AZDO_TOKEN = 'azdo-secret-token'
const azureDevOpsArgs = {
  organizationUrl: 'https://dev.azure.com/contoso',
  azureDevOpsToken: AZDO_TOKEN,
  tokenKind: 'bearer'
} as const

const azdoCloud: DolphinProfileCloudSummary = {
  cloudProfileId: 'cloud-profile-azdo',
  userId: 'user-azdo',
  email: 'dev@contoso.test',
  displayName: 'Dev',
  linkedAt: 10
}
const browserCloud: DolphinProfileCloudSummary = {
  ...azdoCloud,
  cloudProfileId: 'cloud-profile-browser',
  userId: 'user-browser',
  email: 'browser@contoso.test'
}
const capabilities: DolphinCloudCapabilities = { flags: { share: true }, refreshedAt: 11 }
const organizations: DolphinCloudOrgSummary[] = [{ orgId: 'corg-1', name: 'Contoso' }]

function session(cloud: DolphinProfileCloudSummary, accessToken: string): unknown {
  return {
    accessToken,
    refreshToken: `${accessToken}-refresh`,
    expiresAt: Date.now() + 3_600_000,
    cloud,
    organizations,
    capabilities
  }
}

function signedInAnswer(): unknown {
  return {
    status: 'signed-in',
    session: session(azdoCloud, 'azdo-access'),
    organizationName: 'Contoso',
    accountCreated: true
  }
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

const pkceCode = {
  code: 'code',
  codeVerifier: 'verifier',
  nonce: 'nonce',
  redirectUri: 'http://127.0.0.1:4100/auth/callback',
  state: 'state'
}

function filesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    return statSync(path).isDirectory() ? filesUnder(path) : [path]
  })
}

function activeProfileId(): string {
  return ensureActiveDolphinProfile(userDataPath).profile.id
}

let config: DolphinCloudAuthConfig

describe('signInCurrentDolphinProfileWithAzureDevOps', () => {
  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'dolphin-cloud-azdo-sign-in-'))
    _resetCloudConnectAttemptsForTests()
    vi.stubEnv('DOLPHIN_CLOUD_API_URL', 'https://dolphin-cloud.example')
    vi.stubEnv('DOLPHIN_CLOUD_CLIENT_ID', 'desktop-client')
    const configState = getDolphinCloudAuthConfig()
    if (!configState.configured) {
      throw new Error('test config must be configured')
    }
    config = configState.config
    mocks.beginPkce.mockReset().mockResolvedValue(pkceCode)
    mocks.exchangeCode.mockReset().mockResolvedValue(session(browserCloud, 'browser-access'))
    mocks.revoke.mockReset().mockResolvedValue(undefined)
    mocks.azureDevOpsSignIn.mockReset().mockResolvedValue(signedInAnswer())
  })

  afterEach(() => {
    rmSync(userDataPath, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('completes like a browser sign-in and never stores the Azure DevOps token', async () => {
    const signedIn = vi.fn()
    const stop = onDolphinCloudSignedIn(signedIn)
    try {
      await expect(
        signInCurrentDolphinProfileWithAzureDevOps(config, userDataPath, azureDevOpsArgs)
      ).resolves.toEqual({ status: 'signed-in', organizationName: 'Contoso' })
      expect(mocks.azureDevOpsSignIn).toHaveBeenCalledWith(config, {
        ...azureDevOpsArgs,
        localProfileId: activeProfileId()
      })
      expect(getCurrentDolphinProfileAuthStatus(userDataPath)).toMatchObject({
        state: 'connected',
        cloud: { email: 'dev@contoso.test' }
      })
      expect(readDolphinCloudSession(activeProfileId(), userDataPath)).toMatchObject({
        status: 'found',
        session: { accessToken: 'azdo-access' }
      })
      await vi.waitFor(() => expect(signedIn).toHaveBeenCalledTimes(1))
      for (const file of filesUnder(userDataPath)) {
        expect(readFileSync(file, 'utf-8')).not.toContain(AZDO_TOKEN)
      }
    } finally {
      stop()
    }
  })

  it('passes non-sign-in answers through without touching the profile', async () => {
    mocks.azureDevOpsSignIn.mockResolvedValue({ status: 'account-exists' })
    await expect(
      signInCurrentDolphinProfileWithAzureDevOps(config, userDataPath, azureDevOpsArgs)
    ).resolves.toEqual({ status: 'account-exists' })
    expect(getCurrentDolphinProfileAuthStatus(userDataPath).cloud).toBeFalsy()
  })

  it('marks an explicit sign-out and clears it on the next sign-in', async () => {
    await signInCurrentDolphinProfileWithAzureDevOps(config, userDataPath, azureDevOpsArgs)
    await signOutCurrentDolphinProfile(userDataPath)
    expect(hasDolphinCloudExplicitSignOut(activeProfileId(), userDataPath)).toBe(true)
    await expect(connectCurrentDolphinProfile(userDataPath)).resolves.toMatchObject({
      status: 'connected'
    })
    expect(hasDolphinCloudExplicitSignOut(activeProfileId(), userDataPath)).toBe(false)
  })

  it('discards and revokes its session when a sign-out lands mid-request', async () => {
    const answer = deferred<unknown>()
    mocks.azureDevOpsSignIn.mockReturnValue(answer.promise)
    const signingIn = signInCurrentDolphinProfileWithAzureDevOps(
      config,
      userDataPath,
      azureDevOpsArgs
    )
    await signOutCurrentDolphinProfile(userDataPath)
    answer.resolve(signedInAnswer())
    await expect(signingIn).resolves.toEqual({ status: 'superseded' })
    expect(mocks.revoke).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ accessToken: 'azdo-access' })
    )
    expect(getCurrentDolphinProfileAuthStatus(userDataPath).cloud).toBeFalsy()
    expect(readDolphinCloudSession(activeProfileId(), userDataPath).status).toBe('missing')
  })

  it('does not start while a browser sign-in is waiting', async () => {
    const code = deferred<typeof pkceCode>()
    mocks.beginPkce.mockReturnValue(code.promise)
    const browser = connectCurrentDolphinProfile(userDataPath)
    await expect(
      signInCurrentDolphinProfileWithAzureDevOps(config, userDataPath, azureDevOpsArgs)
    ).resolves.toEqual({ status: 'superseded' })
    expect(mocks.azureDevOpsSignIn).not.toHaveBeenCalled()
    code.resolve(pkceCode)
    await expect(browser).resolves.toMatchObject({ status: 'connected' })
    expect(getCurrentDolphinProfileAuthStatus(userDataPath).cloud?.email).toBe(
      'browser@contoso.test'
    )
  })

  it('yields to a browser sign-in that started while it was in flight', async () => {
    const answer = deferred<unknown>()
    mocks.azureDevOpsSignIn.mockReturnValue(answer.promise)
    const code = deferred<typeof pkceCode>()
    mocks.beginPkce.mockReturnValue(code.promise)
    const signingIn = signInCurrentDolphinProfileWithAzureDevOps(
      config,
      userDataPath,
      azureDevOpsArgs
    )
    const browser = connectCurrentDolphinProfile(userDataPath)
    answer.resolve(signedInAnswer())
    await expect(signingIn).resolves.toEqual({ status: 'superseded' })
    expect(mocks.revoke).toHaveBeenCalledTimes(1)
    code.resolve(pkceCode)
    await expect(browser).resolves.toMatchObject({ status: 'connected' })
    expect(getCurrentDolphinProfileAuthStatus(userDataPath).cloud?.email).toBe(
      'browser@contoso.test'
    )
  })

  it('does not overwrite a browser sign-in that finished first', async () => {
    const answer = deferred<unknown>()
    mocks.azureDevOpsSignIn.mockReturnValue(answer.promise)
    const signingIn = signInCurrentDolphinProfileWithAzureDevOps(
      config,
      userDataPath,
      azureDevOpsArgs
    )
    await expect(connectCurrentDolphinProfile(userDataPath)).resolves.toMatchObject({
      status: 'connected'
    })
    answer.resolve(signedInAnswer())
    await expect(signingIn).resolves.toEqual({ status: 'superseded' })
    expect(readDolphinCloudSession(activeProfileId(), userDataPath)).toMatchObject({
      session: { accessToken: 'browser-access' }
    })
  })

  it('lets a later browser sign-in replace an Azure DevOps sign-in', async () => {
    await signInCurrentDolphinProfileWithAzureDevOps(config, userDataPath, azureDevOpsArgs)
    await expect(connectCurrentDolphinProfile(userDataPath)).resolves.toMatchObject({
      status: 'connected'
    })
    expect(getCurrentDolphinProfileAuthStatus(userDataPath).cloud?.email).toBe(
      'browser@contoso.test'
    )
  })
})
