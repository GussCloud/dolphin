import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, args?: unknown) => unknown>(),
  listInventory: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (event: unknown, args?: unknown) => unknown) =>
      mocks.handlers.set(channel, handler)
  }
}))
vi.mock('../github/gh-account-binding-inventory', () => ({
  listGhAccountBindingInventory: mocks.listInventory,
  validateGhAccountBinding: vi.fn()
}))
vi.mock('../github/auth-diagnose', () => ({ diagnoseGhAuth: vi.fn() }))
vi.mock('../github/client', () => ({
  checkDolphinStarred: vi.fn(),
  getAuthenticatedViewer: vi.fn(),
  starDolphin: vi.fn()
}))
vi.mock('../github/rate-limit', () => ({ getRateLimit: vi.fn() }))
vi.mock('../telemetry/cohort-classifier', () => ({ getCohortAtEmit: vi.fn() }))
vi.mock('../telemetry/client', () => ({ track: vi.fn() }))
vi.mock('./github-repo-routing', () => ({
  assertRegisteredGitHubRepo: vi.fn(),
  getGitHubLocalGitOptionArgs: vi.fn()
}))

import { registerGitHubAccountHandlers } from './github-account-handlers'
import type { Store } from '../persistence'

describe('gh:listHostAccounts', () => {
  beforeEach(() => {
    mocks.handlers.clear()
    mocks.listInventory.mockReset()
    mocks.listInventory.mockResolvedValue({ accounts: [] })
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: these handlers never read the store.
    registerGitHubAccountHandlers({} as Store)
  })

  const listHostAccounts = (args?: unknown): unknown =>
    mocks.handlers.get('gh:listHostAccounts')!({}, args)

  it("lists the WSL distro's gh logins when the project runs in WSL", async () => {
    await listHostAccounts({ host: 'github.com', wslDistro: 'Ubuntu-22.04' })
    expect(mocks.listInventory).toHaveBeenCalledWith(
      { wslDistro: 'Ubuntu-22.04' },
      { refreshCapability: false, requiredHost: 'github.com' }
    )
  })

  it('uses the host gh when no distro is given', async () => {
    await listHostAccounts()
    expect(mocks.listInventory).toHaveBeenCalledWith({}, { refreshCapability: false })
  })

  it('rejects a malformed distro instead of listing the host gh logins', async () => {
    await expect(listHostAccounts({ wslDistro: 'Ubuntu; rm -rf /' })).rejects.toThrow(
      'Invalid WSL distro name'
    )
    await expect(listHostAccounts({ wslDistro: 42 })).rejects.toThrow('Invalid WSL distro name')
    expect(mocks.listInventory).not.toHaveBeenCalled()
  })
})
