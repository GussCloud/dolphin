import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DolphinCloudAuthConfig } from './profile-cloud-auth-config'
import { signInToDolphinCloudWithAzureDevOps } from './profile-cloud-azure-devops-sign-in-client'
import { DolphinCloudRequestError } from './profile-cloud-client'

const fetchMock = vi.fn()

const config: DolphinCloudAuthConfig = {
  apiBaseUrl: 'https://dolphin-cloud.example',
  authorizeEndpoint: 'https://dolphin-cloud.example/v1/desktop/auth/authorize',
  sessionEndpoint: 'https://dolphin-cloud.example/v1/desktop/auth/session',
  refreshEndpoint: 'https://dolphin-cloud.example/v1/desktop/auth/refresh',
  capabilitiesEndpoint: 'https://dolphin-cloud.example/v1/desktop/auth/capabilities',
  profileEndpoint: 'https://dolphin-cloud.example/v1/desktop/auth/profile',
  orgEndpoint: 'https://dolphin-cloud.example/v1/desktop/auth/org',
  logoutEndpoint: 'https://dolphin-cloud.example/v1/desktop/auth/logout',
  relayTokenEndpoint: 'https://dolphin-cloud.example/v1/desktop/auth/relay-token',
  relayDirectorUrl: 'https://relay.example',
  clientId: 'desktop-client',
  scope: 'openid profile email offline_access'
}

const args = {
  organizationUrl: 'https://dev.azure.com/contoso',
  azureDevOpsToken: 'entra-token',
  tokenKind: 'bearer' as const,
  localProfileId: 'local-1'
}

const issuedSession = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresAt: 999,
  cloud: { cloudProfileId: 'cp-1', userId: 'usr_1', email: 'dev@contoso.test', linkedAt: 5 },
  organizations: [{ orgId: 'corg_1', name: 'Contoso', role: 'member' }],
  capabilities: { flags: { share: true }, refreshedAt: 1 }
}

function mockJsonResponse(value: unknown, init: { ok?: boolean; status?: number } = {}): void {
  fetchMock.mockResolvedValue({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => value
  })
}

describe('signInToDolphinCloudWithAzureDevOps', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts unauthenticated to the auth service and normalizes the issued session', async () => {
    mockJsonResponse({
      status: 'signed-in',
      session: issuedSession,
      organization: { id: 'corg_1', name: ' Contoso ' },
      azureDevOps: { organizationName: 'contoso', instanceId: 'guid' },
      accountCreated: true
    })
    await expect(signInToDolphinCloudWithAzureDevOps(config, args)).resolves.toEqual({
      status: 'signed-in',
      session: {
        ...issuedSession,
        cloud: {
          ...issuedSession.cloud,
          displayName: undefined,
          activeOrgId: undefined,
          activeOrgName: undefined
        }
      },
      organizationName: 'Contoso',
      accountCreated: true
    })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://dolphin-cloud.example/v1/desktop/auth/azure-devops')
    expect(init).toMatchObject({ method: 'POST', redirect: 'error', body: JSON.stringify(args) })
    expect(init.headers).not.toHaveProperty('authorization')
  })

  it.each([
    [{ status: 'not-registered' }, { status: 'not-registered' }],
    [{ status: 'account-exists' }, { status: 'account-exists' }],
    [{ status: 'unsupported-host' }, { status: 'unsupported-host' }],
    [
      { status: 'invalid-credentials', reason: 'public-org-scope' },
      { status: 'invalid-credentials', reason: 'public-org-scope' }
    ],
    [{ status: 'invalid-credentials', reason: 'newer-reason' }, { status: 'invalid-credentials' }]
  ])('maps %j', async (body, expected) => {
    mockJsonResponse(body)
    await expect(signInToDolphinCloudWithAzureDevOps(config, args)).resolves.toEqual(expected)
  })

  it.each([
    { status: 'signed-in', session: issuedSession, organization: {} },
    {
      status: 'signed-in',
      session: { ...issuedSession, accessToken: '' },
      organization: { name: 'X' }
    },
    { status: 'something-new' },
    null
  ])('rejects the malformed answer %j', async (body) => {
    mockJsonResponse(body)
    await expect(signInToDolphinCloudWithAzureDevOps(config, args)).rejects.toThrow(
      /invalid_dolphin/
    )
  })

  it('surfaces HTTP failures with the server error code', async () => {
    mockJsonResponse({ error: 'invalid_request' }, { ok: false, status: 400 })
    await expect(signInToDolphinCloudWithAzureDevOps(config, args)).rejects.toEqual(
      new DolphinCloudRequestError(400, 'invalid_request')
    )
  })
})
