import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RateLimitService } from './service'
import { resetRateLimitProviderMocks } from './rate-limit-service-test-harness'

vi.mock('./claude-fetcher', () => ({
  fetchClaudeRateLimits: vi.fn(),
  fetchManagedAccountUsage: vi.fn()
}))

vi.mock('./codex-fetcher', () => ({
  consumeCodexRateLimitResetCredit: vi.fn(),
  fetchCodexRateLimits: vi.fn()
}))

vi.mock('./gemini-usage-fetcher', () => ({
  fetchGeminiRateLimits: vi.fn()
}))

vi.mock('./kimi-fetcher', () => ({
  fetchKimiRateLimits: vi.fn()
}))

vi.mock('./opencode-go-usage-source-selection', () => ({
  fetchOpenCodeGoUsage: vi.fn()
}))

vi.mock('./minimax/minimax-fetcher', () => ({
  fetchMiniMaxRateLimits: vi.fn()
}))

vi.mock('./grok-fetcher', () => ({
  fetchGrokRateLimits: vi.fn()
}))

vi.mock('./cursor-fetcher', () => ({
  fetchCursorRateLimits: vi.fn()
}))

vi.mock('./cursor-auth', () => ({
  readCursorAuthSession: vi.fn()
}))

vi.mock('./grok-auth', () => ({
  readGrokAuthSession: vi.fn(() => ({ status: 'missing' }))
}))

vi.mock('../minimax/minimax-cookie-store', () => ({
  hasMiniMaxSessionCookie: vi.fn(() => false)
}))

describe('RateLimitService pinned Claude usage', () => {
  beforeEach(() => {
    resetRateLimitProviderMocks()
  })

  const PINNED_DIR = '/data/claude-accounts/acct-pinned/config'

  it('routes a pinned config dir post to that inactive account, not the active bar', () => {
    const service = new RateLimitService()
    service.setInactiveClaudeAccountsResolver(() => [
      {
        id: 'acct-pinned',
        managedAuthPath: '/data/claude-accounts/acct-pinned/auth',
        pinnedConfigDir: PINNED_DIR
      }
    ])

    service.ingestLiveClaudeRateLimits({
      configDir: `${PINNED_DIR}/`,
      fiveHour: { used_percentage: 61 },
      sevenDay: { used_percentage: 12 }
    })

    const state = service.getState()
    expect(state.claude).toBeNull()
    const pinned = state.inactiveClaudeAccounts.find((entry) => entry.accountId === 'acct-pinned')
    expect(pinned?.rateLimits?.session?.usedPercent).toBe(61)
    expect(pinned?.rateLimits?.usageMetadata?.source).toBe('live-session')
  })

  it('still drops a post from an unknown config dir', () => {
    const service = new RateLimitService()
    service.setInactiveClaudeAccountsResolver(() => [
      {
        id: 'acct-pinned',
        managedAuthPath: '/data/claude-accounts/acct-pinned/auth',
        pinnedConfigDir: PINNED_DIR
      }
    ])

    service.ingestLiveClaudeRateLimits({
      configDir: '/somewhere/else',
      fiveHour: { used_percentage: 61 },
      sevenDay: null
    })

    expect(service.getState().claude).toBeNull()
    expect(service.getState().inactiveClaudeAccounts).toEqual([])
  })
})
