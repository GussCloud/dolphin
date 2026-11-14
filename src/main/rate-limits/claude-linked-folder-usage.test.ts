import { describe, expect, it, vi } from 'vitest'
import type { ProviderRateLimits } from '../../shared/rate-limit-types'
import { fetchLinkedFolderClaudeUsage } from './claude-linked-folder-usage'

vi.mock('../claude-accounts/oauth-refresh', () => ({
  isOauthTokenExpiring: (json: string) => JSON.parse(json).claudeAiOauth.expiresAt < Date.now()
}))
vi.mock('../claude-accounts/keychain', () => ({
  readActiveClaudeKeychainCredentialsStrict: vi.fn()
}))

const usage: ProviderRateLimits = {
  provider: 'claude',
  session: null,
  weekly: null,
  updatedAt: 1,
  error: null,
  status: 'ok'
}

function credentials(expiresAt: number): string {
  return JSON.stringify({
    claudeAiOauth: { accessToken: 'tok', refreshToken: 'ref', expiresAt }
  })
}

describe('fetchLinkedFolderClaudeUsage', () => {
  it("reads the folder's own Keychain item on macOS, the default folder's unsuffixed one", async () => {
    const readKeychain = vi.fn(async () => credentials(Date.now() + 60_000))
    const fetchUsage = vi.fn(async () => usage)
    const deps = { platform: 'darwin' as const, home: '/Users/me', readKeychain, fetchUsage }

    await fetchLinkedFolderClaudeUsage('/Users/me/.claude-empresa', {}, deps)
    await fetchLinkedFolderClaudeUsage('/Users/me/.claude', {}, deps)

    expect(readKeychain).toHaveBeenNthCalledWith(1, '/Users/me/.claude-empresa')
    expect(readKeychain).toHaveBeenNthCalledWith(2, undefined)
    expect(fetchUsage).toHaveBeenCalledWith('tok', undefined)
  })

  it("reads the folder's credentials file elsewhere", async () => {
    const readFile = vi.fn(() => credentials(Date.now() + 60_000))
    const result = await fetchLinkedFolderClaudeUsage(
      '/home/me/.claude-empresa',
      {},
      { platform: 'linux', readFile, fetchUsage: async () => usage }
    )
    expect(readFile).toHaveBeenCalledWith('/home/me/.claude-empresa/.credentials.json')
    expect(result.status).toBe('ok')
  })

  it('never refreshes an expired login: it says to renew it from the terminal', async () => {
    const fetchUsage = vi.fn(async () => usage)
    const result = await fetchLinkedFolderClaudeUsage(
      '/home/me/.claude-empresa',
      {},
      { platform: 'linux', readFile: () => credentials(1), fetchUsage }
    )
    expect(result.status).toBe('error')
    expect(result.error).toContain('terminal')
    expect(fetchUsage).not.toHaveBeenCalled()
  })

  it('reports missing credentials without touching anything', async () => {
    const result = await fetchLinkedFolderClaudeUsage(
      '/home/me/.claude-empresa',
      {},
      { platform: 'linux', readFile: () => null }
    )
    expect(result.error).toBe('No credentials')
  })
})
