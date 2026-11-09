import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fetchInactiveClaudeAccountUsage } from './claude-managed-account-usage'
import { refreshClaudeOauthCredentials } from '../claude-accounts/oauth-refresh'
import { markClaudePtyExited, markClaudePtySpawned } from '../claude-accounts/live-pty-gate'

const { appGetPathMock } = vi.hoisted(() => ({ appGetPathMock: vi.fn() }))

vi.mock('electron', () => ({ app: { getPath: appGetPathMock } }))
vi.mock('../claude-accounts/oauth-refresh', () => ({
  isOauthTokenExpiring: vi.fn(() => true),
  refreshClaudeOauthCredentials: vi.fn(async () => null)
}))
vi.mock('./claude-oauth-usage-request', () => ({
  fetchClaudeOAuthUsage: vi.fn(async () => ({
    provider: 'claude',
    session: null,
    weekly: null,
    updatedAt: 0,
    error: null,
    status: 'ok'
  }))
}))

const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')
let root = ''

function account(withPinnedDir: boolean) {
  const authPath = join(root, 'claude-accounts', 'acct', 'auth')
  mkdirSync(authPath, { recursive: true })
  writeFileSync(join(authPath, '.dolphin-managed-claude-auth'), 'acct\n')
  writeFileSync(
    join(authPath, '.credentials.json'),
    JSON.stringify({ claudeAiOauth: { accessToken: 'a', refreshToken: 'r', expiresAt: 1 } })
  )
  const pinnedConfigDir = join(root, 'claude-accounts', 'acct', 'config')
  if (withPinnedDir) {
    mkdirSync(pinnedConfigDir, { recursive: true })
  }
  return { id: 'acct', managedAuthPath: authPath, pinnedConfigDir }
}

describe('inactive Claude usage refresh beside a pinned worktree', () => {
  beforeEach(() => {
    Object.defineProperty(process, 'platform', { configurable: true, value: 'linux' })
    root = mkdtempSync(join(tmpdir(), 'dolphin-pinned-refresh-'))
    appGetPathMock.mockReturnValue(root)
    vi.mocked(refreshClaudeOauthCredentials).mockClear()
  })

  afterEach(() => {
    markClaudePtyExited('live-claude')
    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform)
    }
    rmSync(root, { recursive: true, force: true })
  })

  it('does not rotate the token a live pinned pane may hold', async () => {
    markClaudePtySpawned('live-claude')
    await fetchInactiveClaudeAccountUsage(account(true))
    expect(refreshClaudeOauthCredentials).not.toHaveBeenCalled()
  })

  it('still refreshes when no Claude is running', async () => {
    await fetchInactiveClaudeAccountUsage(account(true))
    expect(refreshClaudeOauthCredentials).toHaveBeenCalledTimes(1)
  })
})
