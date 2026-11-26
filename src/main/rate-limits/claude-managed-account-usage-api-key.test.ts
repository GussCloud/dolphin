import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readCredentials: vi.fn(async () => null),
  fetchUsage: vi.fn(),
  refresh: vi.fn()
}))

vi.mock('electron', () => ({ app: { getPath: () => '/tmp/dolphin-api-usage' } }))
vi.mock('./claude-managed-account-credentials', () => ({
  readClaudeManagedCredentialsJson: mocks.readCredentials,
  resolveClaudeManagedCredentialsLocation: vi.fn(() => ({ kind: 'file', managedAuthPath: '/x' })),
  writeClaudeManagedCredentialsJson: vi.fn()
}))
vi.mock('./claude-oauth-usage-request', () => ({ fetchClaudeOAuthUsage: mocks.fetchUsage }))
vi.mock('../claude-accounts/oauth-refresh', () => ({
  isOauthTokenExpiring: vi.fn(() => true),
  refreshClaudeOauthCredentials: mocks.refresh
}))

describe('fetchInactiveClaudeAccountUsage for an API account', () => {
  it('reports no plan usage without reading credentials, refreshing or calling the usage API', async () => {
    const { fetchInactiveClaudeAccountUsage } = await import('./claude-managed-account-usage')

    const result = await fetchInactiveClaudeAccountUsage({
      id: 'api',
      managedAuthPath: '/data/claude-accounts/api/auth',
      apiKeyAccount: true
    })

    expect(result).toMatchObject({
      status: 'unavailable',
      error: null,
      session: null,
      weekly: null
    })
    expect(mocks.readCredentials).not.toHaveBeenCalled()
    expect(mocks.refresh).not.toHaveBeenCalled()
    expect(mocks.fetchUsage).not.toHaveBeenCalled()
  })
})
