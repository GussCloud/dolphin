import { describe, expect, it, vi } from 'vitest'
import type { ProviderRateLimits } from '../../shared/rate-limit-types'
import { fetchLinkedFolderClaudeUsage } from './claude-linked-folder-usage'

vi.mock('../claude-accounts/oauth-refresh', () => ({
  isOauthTokenExpiring: (json: string) => JSON.parse(json).claudeAiOauth.expiresAt < Date.now(),
  refreshClaudeOauthCredentials: vi.fn()
}))
vi.mock('../claude-accounts/keychain', () => ({
  readActiveClaudeKeychainCredentialsStrict: vi.fn(),
  writeActiveClaudeKeychainCredentials: vi.fn(),
  writeClaudeKeychainCredentialsForConfigDir: vi.fn()
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

  it('renews an expired login and writes it back where the CLI keeps it', async () => {
    const renewed = credentials(Date.now() + 60_000)
    const writeFile = vi.fn()
    const fetchUsage = vi.fn(async () => usage)
    const result = await fetchLinkedFolderClaudeUsage(
      '/home/me/.claude-empresa',
      {},
      {
        platform: 'linux',
        readFile: () => credentials(1),
        refresh: async () => renewed,
        writeFile,
        hasLivePtys: () => false,
        fetchUsage
      }
    )
    expect(writeFile).toHaveBeenCalledWith('/home/me/.claude-empresa/.credentials.json', renewed)
    expect(result.status).toBe('ok')
  })

  it('renews into the folder Keychain item on macOS, the unsuffixed one for ~/.claude', async () => {
    const writeKeychain = vi.fn(async (_contents: string, _configDir?: string) => {})
    const deps = {
      platform: 'darwin' as const,
      home: '/Users/me',
      readKeychain: async () => credentials(1),
      refresh: async () => credentials(Date.now() + 60_000),
      writeKeychain,
      hasLivePtys: () => false,
      fetchUsage: async () => usage
    }
    await fetchLinkedFolderClaudeUsage('/Users/me/.claude-empresa', {}, deps)
    await fetchLinkedFolderClaudeUsage('/Users/me/.claude', {}, deps)
    expect(writeKeychain.mock.calls.map((call) => call[1])).toEqual([
      '/Users/me/.claude-empresa',
      undefined
    ])
  })

  it('does not renew while a Claude terminal runs in Dolphin, and never writes then', async () => {
    const refresh = vi.fn()
    const writeFile = vi.fn()
    const result = await fetchLinkedFolderClaudeUsage(
      '/home/me/.claude-empresa',
      {},
      {
        platform: 'linux',
        readFile: () => credentials(1),
        refresh,
        writeFile,
        hasLivePtys: () => true
      }
    )
    expect(refresh).not.toHaveBeenCalled()
    expect(writeFile).not.toHaveBeenCalled()
    expect(result.error).toContain('terminal')
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
