import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AzureDevOpsAuthStatus } from '../../shared/azure-devops-auth'
import { DolphinCloudRequestError } from '../dolphin-profiles/profile-cloud-client'

type ProfileFixture = { id: string; cloud?: { userId: string } }

const mocks = vi.hoisted(() => {
  const authStatusListeners: ((status: unknown) => void)[] = []
  const method: { current: 'azure-cli' | 'token' } = { current: 'azure-cli' }
  const profile: { current: ProfileFixture } = {
    current: { id: 'local-1', cloud: { userId: 'user-1' } }
  }
  return {
    authStatus: vi.fn(),
    authStatusListeners,
    cliToken: vi.fn(),
    method,
    envConfig: vi.fn(),
    runOrgMemberCall: vi.fn(),
    link: vi.fn(),
    readSession: vi.fn(),
    profile
  }
})

vi.mock('./azure-devops-auth-status', () => ({
  getAzureDevOpsAuthStatus: mocks.authStatus,
  onAzureDevOpsAuthStatus: (listener: (status: unknown) => void) => {
    mocks.authStatusListeners.push(listener)
    return () => undefined
  }
}))
vi.mock('./azure-cli-access-token', () => ({ getAzureCliAccessToken: mocks.cliToken }))
vi.mock('./azure-devops-auth-preference-store', () => ({
  getAzureDevOpsAuthPreference: () => ({ method: mocks.method.current, autoRenewCliSession: false })
}))
vi.mock('./azure-devops-env-config', () => ({ getAzureDevOpsAuthConfig: mocks.envConfig }))
vi.mock('../dolphin-profiles/profile-cloud-org-members-service', () => ({
  runOrgMemberCall: mocks.runOrgMemberCall
}))
vi.mock('../dolphin-profiles/profile-cloud-org-members-client', () => ({
  linkDolphinCloudOrgByAzureDevOps: mocks.link
}))
vi.mock('../dolphin-profiles/profile-cloud-session-store', () => ({
  readDolphinCloudSession: mocks.readSession
}))
vi.mock('../dolphin-profiles/profile-index-store', () => ({
  ensureActiveDolphinProfile: () => ({ profile: mocks.profile.current })
}))
vi.mock('../dolphin-profiles/profile-storage-paths', () => ({
  getProfileUserDataPath: () => '/user-data'
}))

import {
  _resetAzureDevOpsOrgLinkState,
  getAzureDevOpsOrgLink,
  startAzureDevOpsOrgLinkAutoCheck
} from './dolphin-org-link'

const authenticated: AzureDevOpsAuthStatus = {
  configured: true,
  authenticated: true,
  account: 'dev@contoso.test',
  baseUrl: 'https://dev.azure.com/Contoso',
  tokenConfigured: false,
  authMethod: 'azure-cli'
}

const fakeSession = { accessToken: 'dolphin-access' }

function serverAnswers(value: unknown): void {
  mocks.link.mockResolvedValue(value)
  mocks.runOrgMemberCall.mockImplementation(
    async (_config: unknown, _active: unknown, _path: unknown, call: (s: unknown) => unknown) => ({
      status: 'ok',
      value: await call(fakeSession)
    })
  )
}

beforeEach(() => {
  _resetAzureDevOpsOrgLinkState()
  vi.stubEnv('DOLPHIN_CLOUD_API_URL', 'https://dolphin-cloud.example')
  vi.stubEnv('DOLPHIN_CLOUD_CLIENT_ID', 'desktop-client')
  vi.stubEnv('DOLPHIN_CLOUD_DEV_AUTH', '')
  mocks.authStatus.mockResolvedValue(authenticated)
  mocks.cliToken.mockResolvedValue('entra-token')
  mocks.method.current = 'azure-cli'
  mocks.envConfig.mockReturnValue({
    apiBaseUrl: null,
    pat: null,
    accessToken: null,
    username: null
  })
  mocks.readSession.mockReturnValue({ status: 'found' })
  mocks.profile.current = { id: 'local-1', cloud: { userId: 'user-1' } }
  mocks.authStatusListeners.length = 0
  serverAnswers({ status: 'connected', organizationName: 'Contoso' })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('getAzureDevOpsOrgLink', () => {
  it('links with the Azure CLI bearer token and the canonical organization URL', async () => {
    await expect(getAzureDevOpsOrgLink()).resolves.toEqual({
      status: 'connected',
      organizationName: 'Contoso'
    })
    expect(mocks.link).toHaveBeenCalledWith(expect.anything(), fakeSession, {
      organizationUrl: 'https://dev.azure.com/contoso',
      azureDevOpsToken: 'entra-token',
      tokenKind: 'bearer'
    })
  })

  it('sends a PAT as tokenKind pat in token mode', async () => {
    mocks.method.current = 'token'
    mocks.authStatus.mockResolvedValue({ ...authenticated, authMethod: 'token' })
    mocks.envConfig.mockReturnValue({
      apiBaseUrl: null,
      pat: 'my-pat',
      accessToken: null,
      username: null
    })
    await getAzureDevOpsOrgLink()
    expect(mocks.link.mock.calls[0][2]).toMatchObject({
      azureDevOpsToken: 'my-pat',
      tokenKind: 'pat'
    })
  })

  it('serves the cached answer until forced', async () => {
    await getAzureDevOpsOrgLink()
    await getAzureDevOpsOrgLink()
    expect(mocks.link).toHaveBeenCalledTimes(1)
    serverAnswers({ status: 'not-registered' })
    await expect(getAzureDevOpsOrgLink({ force: true })).resolves.toEqual({
      status: 'not-registered'
    })
    expect(mocks.link).toHaveBeenCalledTimes(2)
  })

  it('does not cache failures', async () => {
    mocks.runOrgMemberCall.mockResolvedValue({
      status: 'request-error',
      error: new DolphinCloudRequestError(502, 'azure_devops_unavailable')
    })
    await expect(getAzureDevOpsOrgLink()).resolves.toEqual({
      status: 'error',
      reason: 'Azure DevOps is unavailable right now'
    })
    serverAnswers({ status: 'not-registered' })
    await expect(getAzureDevOpsOrgLink()).resolves.toEqual({ status: 'not-registered' })
  })

  it('reports signed-out without a Dolphin session and skips the server', async () => {
    mocks.readSession.mockReturnValue({ status: 'missing' })
    await expect(getAzureDevOpsOrgLink()).resolves.toEqual({ status: 'signed-out' })
    mocks.profile.current = { id: 'local-1' }
    mocks.readSession.mockReturnValue({ status: 'found' })
    await expect(getAzureDevOpsOrgLink()).resolves.toEqual({ status: 'signed-out' })
    expect(mocks.runOrgMemberCall).not.toHaveBeenCalled()
  })

  it('reports signed-out when the Dolphin session is rejected', async () => {
    mocks.runOrgMemberCall.mockResolvedValue({ status: 'reconnect-required' })
    await expect(getAzureDevOpsOrgLink()).resolves.toEqual({ status: 'signed-out' })
  })

  it('maps rejected Azure DevOps credentials', async () => {
    serverAnswers({ status: 'invalid-credentials' })
    await expect(getAzureDevOpsOrgLink()).resolves.toEqual({
      status: 'azure-devops-not-authenticated'
    })
  })

  it('reports an unauthenticated Azure DevOps host without a request', async () => {
    mocks.authStatus.mockResolvedValue({ ...authenticated, authenticated: false })
    await expect(getAzureDevOpsOrgLink()).resolves.toEqual({
      status: 'azure-devops-not-authenticated'
    })
    mocks.authStatus.mockResolvedValue(authenticated)
    mocks.cliToken.mockRejectedValue(new Error('signed out'))
    await expect(getAzureDevOpsOrgLink()).resolves.toEqual({
      status: 'azure-devops-not-authenticated'
    })
    expect(mocks.runOrgMemberCall).not.toHaveBeenCalled()
  })

  it('rejects hosts the auth server does not accept before sending the token', async () => {
    mocks.authStatus.mockResolvedValue({
      ...authenticated,
      baseUrl: 'https://tfs.contoso.local/tfs'
    })
    await expect(getAzureDevOpsOrgLink()).resolves.toEqual({ status: 'unsupported-host' })
    mocks.authStatus.mockResolvedValue({ ...authenticated, baseUrl: null })
    await expect(getAzureDevOpsOrgLink()).resolves.toEqual({ status: 'no-organization' })
    expect(mocks.cliToken).not.toHaveBeenCalled()
  })

  it('surfaces other failures as errors', async () => {
    mocks.runOrgMemberCall.mockResolvedValue({ status: 'failed', error: 'fetch failed' })
    await expect(getAzureDevOpsOrgLink()).resolves.toEqual({
      status: 'error',
      reason: 'fetch failed'
    })
  })

  it('keeps the Azure DevOps token out of cached state and errors', async () => {
    mocks.runOrgMemberCall.mockResolvedValue({ status: 'failed', error: 'fetch failed' })
    const failed = await getAzureDevOpsOrgLink()
    serverAnswers({ status: 'connected', organizationName: 'Contoso' })
    const connected = await getAzureDevOpsOrgLink()
    expect(JSON.stringify([failed, connected])).not.toContain('entra-token')
  })
})

describe('startAzureDevOpsOrgLinkAutoCheck', () => {
  it('links once when the host becomes authenticated and reuses that status', async () => {
    startAzureDevOpsOrgLinkAutoCheck()
    const [listener] = mocks.authStatusListeners
    listener({ ...authenticated, authenticated: false })
    expect(mocks.cliToken).not.toHaveBeenCalled()
    listener(authenticated)
    listener(authenticated)
    await vi.waitFor(() => expect(mocks.link).toHaveBeenCalledTimes(1))
    await expect(getAzureDevOpsOrgLink()).resolves.toMatchObject({ status: 'connected' })
    expect(mocks.authStatus).not.toHaveBeenCalled()
    expect(mocks.link).toHaveBeenCalledTimes(1)
  })
})
