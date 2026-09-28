import { describe, expect, it, vi } from 'vitest'
import {
  allowsPlaintextDolphinCloudSession,
  getDolphinCloudAuthConfig,
  isDolphinCloudDevAuthEnabled
} from './profile-cloud-auth-config'

vi.mock('electron', () => ({
  app: {
    isPackaged: false
  }
}))

describe('Dolphin cloud auth config', () => {
  it('reports unconfigured without both API URL and client ID', () => {
    expect(getDolphinCloudAuthConfig({})).toEqual({
      configured: false,
      setupMessage: 'Dolphin Cloud sign-in is not configured for this build.'
    })
  })

  it('builds default desktop auth endpoints from the API URL', () => {
    const state = getDolphinCloudAuthConfig({
      DOLPHIN_CLOUD_API_URL: 'https://dolphin-cloud.example/',
      DOLPHIN_CLOUD_CLIENT_ID: 'desktop-client'
    })

    expect(state).toEqual({
      configured: true,
      config: {
        apiBaseUrl: 'https://dolphin-cloud.example',
        authorizeEndpoint: 'https://dolphin-cloud.example/v1/desktop/auth/authorize',
        sessionEndpoint: 'https://dolphin-cloud.example/v1/desktop/auth/session',
        refreshEndpoint: 'https://dolphin-cloud.example/v1/desktop/auth/refresh',
        capabilitiesEndpoint: 'https://dolphin-cloud.example/v1/desktop/auth/capabilities',
        profileEndpoint: 'https://dolphin-cloud.example/v1/desktop/auth/profile',
        orgEndpoint: 'https://dolphin-cloud.example/v1/desktop/auth/org',
        logoutEndpoint: 'https://dolphin-cloud.example/v1/desktop/auth/logout',
        relayTokenEndpoint: 'https://dolphin-cloud.example/v1/desktop/auth/relay-token',
        relayDirectorUrl: 'https://relay.dolphin.guss.dev.br',
        clientId: 'desktop-client',
        scope: 'openid profile email offline_access'
      }
    })
  })

  it('uses first-party production endpoints without runtime env in packaged builds', () => {
    expect(getDolphinCloudAuthConfig({}, true)).toEqual({
      configured: true,
      config: {
        apiBaseUrl: 'https://auth.dolphin.guss.dev.br',
        authorizeEndpoint: 'https://auth.dolphin.guss.dev.br/v1/desktop/auth/authorize',
        sessionEndpoint: 'https://auth.dolphin.guss.dev.br/v1/desktop/auth/session',
        refreshEndpoint: 'https://auth.dolphin.guss.dev.br/v1/desktop/auth/refresh',
        capabilitiesEndpoint: 'https://auth.dolphin.guss.dev.br/v1/desktop/auth/capabilities',
        profileEndpoint: 'https://auth.dolphin.guss.dev.br/v1/desktop/auth/profile',
        orgEndpoint: 'https://auth.dolphin.guss.dev.br/v1/desktop/auth/org',
        logoutEndpoint: 'https://auth.dolphin.guss.dev.br/v1/desktop/auth/logout',
        relayTokenEndpoint: 'https://auth.dolphin.guss.dev.br/v1/desktop/auth/relay-token',
        relayDirectorUrl: 'https://relay.dolphin.guss.dev.br',
        clientId: 'dolphin-desktop',
        scope: 'openid profile email offline_access'
      }
    })
  })

  it('allows loopback HTTP endpoints for local desktop auth development', () => {
    const state = getDolphinCloudAuthConfig({
      DOLPHIN_CLOUD_API_URL: 'http://localhost:4100',
      DOLPHIN_CLOUD_CLIENT_ID: 'desktop-client'
    })

    expect(state.configured).toBe(true)
  })

  it('rejects loopback HTTP endpoints in packaged builds', () => {
    expect(
      getDolphinCloudAuthConfig(
        {
          DOLPHIN_CLOUD_API_URL: 'http://localhost:4100',
          DOLPHIN_CLOUD_CLIENT_ID: 'desktop-client'
        },
        true
      )
    ).toMatchObject({ configured: false })

    const httpsState = getDolphinCloudAuthConfig(
      {
        DOLPHIN_CLOUD_API_URL: 'https://dolphin-cloud.example',
        DOLPHIN_CLOUD_CLIENT_ID: 'desktop-client'
      },
      true
    )
    expect(httpsState.configured).toBe(true)
  })

  it('rejects non-HTTPS non-loopback API URLs', () => {
    expect(
      getDolphinCloudAuthConfig({
        DOLPHIN_CLOUD_API_URL: 'http://dolphin-cloud.example',
        DOLPHIN_CLOUD_CLIENT_ID: 'desktop-client'
      })
    ).toMatchObject({ configured: false })
  })

  it('allows dev plaintext sessions only outside production', () => {
    expect(
      allowsPlaintextDolphinCloudSession({
        DOLPHIN_CLOUD_ALLOW_PLAINTEXT_SESSION: '1',
        NODE_ENV: 'development'
      })
    ).toBe(true)
    expect(
      allowsPlaintextDolphinCloudSession({
        DOLPHIN_CLOUD_ALLOW_PLAINTEXT_SESSION: '1',
        NODE_ENV: 'production'
      })
    ).toBe(false)
  })

  it('ignores dev flags in packaged builds even without NODE_ENV', () => {
    // Why: packaged main bundles never define NODE_ENV, so packaged-ness must
    // gate the escape hatches on its own.
    expect(
      allowsPlaintextDolphinCloudSession({ DOLPHIN_CLOUD_ALLOW_PLAINTEXT_SESSION: '1' }, true)
    ).toBe(false)
    expect(isDolphinCloudDevAuthEnabled({ DOLPHIN_CLOUD_DEV_AUTH: '1' }, true)).toBe(false)
  })

  it('allows local dev auth only outside production', () => {
    expect(
      isDolphinCloudDevAuthEnabled({
        DOLPHIN_CLOUD_DEV_AUTH: '1',
        NODE_ENV: 'development'
      })
    ).toBe(true)
    expect(
      isDolphinCloudDevAuthEnabled({
        DOLPHIN_CLOUD_DEV_AUTH: '1',
        NODE_ENV: 'production'
      })
    ).toBe(false)
  })
})
