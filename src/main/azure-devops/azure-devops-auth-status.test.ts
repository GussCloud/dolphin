import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AzureCliStatus } from '../../shared/azure-devops-auth'
import { getAzureDevOpsAuthStatus } from './azure-devops-auth-status'

const mocks = vi.hoisted(() => ({
  preference: vi.fn(),
  cliStatus: vi.fn(),
  token: vi.fn(),
  expiresAt: vi.fn(),
  forget: vi.fn()
}))

vi.mock('./azure-devops-auth-preference-store', () => ({
  getAzureDevOpsAuthPreference: mocks.preference
}))
vi.mock('./azure-cli-status', () => ({ getAzureCliStatus: mocks.cliStatus }))
vi.mock('./azure-cli-access-token', () => ({ getAzureCliAccessToken: mocks.token }))
vi.mock('./azure-cli-session-store', () => ({
  getAzureCliTokenExpiresAt: mocks.expiresAt,
  forgetAzureCliSession: mocks.forget
}))

const signedIn: AzureCliStatus = {
  installed: true,
  devopsExtensionInstalled: true,
  authenticated: true,
  account: 'dev@contoso.com',
  defaultOrganization: 'https://dev.azure.com/contoso',
  defaultProject: null
}

const OLD_ENV = process.env

describe('getAzureDevOpsAuthStatus in azure-cli mode', () => {
  beforeEach(() => {
    process.env = { ...OLD_ENV }
    delete process.env.DOLPHIN_AZURE_DEVOPS_API_BASE_URL
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.preference.mockReturnValue({ method: 'azure-cli', autoRenewCliSession: true })
    mocks.expiresAt.mockReturnValue(null)
  })

  it('reports the saved token validity and the auto-renew choice', async () => {
    mocks.cliStatus.mockResolvedValue({ ...signedIn, defaultOrganization: null })
    mocks.token.mockResolvedValue('entra-token')
    mocks.expiresAt.mockReturnValue(1_900_000_000_000)

    const status = await getAzureDevOpsAuthStatus()
    expect(status.autoRenewCliSession).toBe(true)
    expect(status.azureCli?.tokenExpiresAt).toBe(1_900_000_000_000)
    expect(mocks.forget).not.toHaveBeenCalled()
  })

  it('forgets the session after the user signs out of the CLI', async () => {
    mocks.cliStatus.mockResolvedValue({ ...signedIn, authenticated: false, account: null })
    await getAzureDevOpsAuthStatus()
    expect(mocks.forget).toHaveBeenCalledOnce()
  })

  afterEach(() => {
    process.env = OLD_ENV
    vi.unstubAllGlobals()
  })

  it('probes the default organization with the CLI bearer token', async () => {
    mocks.cliStatus.mockResolvedValue(signedIn)
    mocks.token.mockResolvedValue('entra-token')
    const authorizations: (string | null)[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        expect(new URL(String(input)).pathname).toBe('/contoso/_apis/connectionData')
        authorizations.push(new Headers(init?.headers).get('Authorization'))
        return Response.json({ authenticatedUser: { providerDisplayName: 'Dev User' } })
      })
    )

    await expect(getAzureDevOpsAuthStatus()).resolves.toMatchObject({
      authMethod: 'azure-cli',
      configured: true,
      authenticated: true,
      account: 'Dev User',
      baseUrl: 'https://dev.azure.com/contoso'
    })
    expect(authorizations).toEqual(['Bearer entra-token'])
  })

  it('treats a cached account whose token was revoked as signed out', async () => {
    mocks.cliStatus.mockResolvedValue(signedIn)
    mocks.token.mockRejectedValue(new Error('AADSTS70043: The refresh token has expired'))
    vi.stubGlobal('fetch', vi.fn())

    const status = await getAzureDevOpsAuthStatus()
    expect(status).toMatchObject({ authenticated: false, azureCli: { authenticated: false } })
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('reports signed in without probing when no organization is known', async () => {
    mocks.cliStatus.mockResolvedValue({ ...signedIn, defaultOrganization: null })
    mocks.token.mockResolvedValue('entra-token')
    vi.stubGlobal('fetch', vi.fn())

    await expect(getAzureDevOpsAuthStatus()).resolves.toMatchObject({
      authenticated: true,
      account: 'dev@contoso.com',
      baseUrl: null
    })
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
