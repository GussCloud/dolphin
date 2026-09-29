import { describe, expect, it } from 'vitest'
import type { AzureCliStatus, AzureDevOpsAuthStatus } from '../../../../shared/azure-devops-auth'
import { deriveAzureCliCardState } from './azure-cli-card-state'
import { tokenApiStatusFromPreflight } from './integrations-pane-status'

const cli = (overrides: Partial<AzureCliStatus> = {}): AzureCliStatus => ({
  installed: true,
  devopsExtensionInstalled: true,
  authenticated: true,
  account: 'dev@contoso.com',
  defaultOrganization: null,
  defaultProject: null,
  ...overrides
})

const status = (overrides: Partial<AzureDevOpsAuthStatus> = {}): AzureDevOpsAuthStatus => ({
  configured: true,
  authenticated: true,
  account: null,
  baseUrl: null,
  tokenConfigured: false,
  authMethod: 'azure-cli',
  azureCli: cli(),
  ...overrides
})

describe('deriveAzureCliCardState', () => {
  it('walks the setup steps in order', () => {
    expect(deriveAzureCliCardState(status(), true)).toBe('checking')
    expect(deriveAzureCliCardState(status({ azureCli: cli({ installed: false }) }), false)).toBe(
      'not-installed'
    )
    expect(
      deriveAzureCliCardState(status({ azureCli: cli({ authenticated: false }) }), false)
    ).toBe('not-authenticated')
    expect(deriveAzureCliCardState(status({ authenticated: false }), false)).toBe('no-access')
    expect(deriveAzureCliCardState(status(), false)).toBe('connected')
  })

  it('is unavailable while the host still reports token mode or predates the option', () => {
    expect(deriveAzureCliCardState(status({ authMethod: 'token' }), false)).toBe('unavailable')
    expect(deriveAzureCliCardState(undefined, false)).toBe('unavailable')
  })
})

describe('tokenApiStatusFromPreflight in azure-cli mode', () => {
  it('reports not-configured until the CLI is signed in, then the org probe result', () => {
    expect(tokenApiStatusFromPreflight(status({ azureCli: cli({ authenticated: false }) }))).toBe(
      'not-configured'
    )
    expect(tokenApiStatusFromPreflight(status({ authenticated: false }))).toBe('not-authenticated')
    expect(tokenApiStatusFromPreflight(status())).toBe('configured')
  })
})
