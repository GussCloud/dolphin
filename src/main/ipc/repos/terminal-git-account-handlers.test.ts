import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, args?: unknown) => unknown>(),
  warnings: vi.fn(),
  gitOptions: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: {
    removeHandler: vi.fn(),
    handle: (channel: string, handler: (event: unknown, args?: unknown) => unknown) =>
      mocks.handlers.set(channel, handler)
  }
}))
vi.mock('../../pty/terminal-git-account-env', () => ({
  getTerminalGitAccountWarnings: mocks.warnings
}))
vi.mock('../../project-runtime-git-options', () => ({
  getLocalProjectWorktreeGitOptions: mocks.gitOptions
}))

import type { Store } from '../../persistence'
import { registerTerminalGitAccountHandlers } from './terminal-git-account-handlers'

describe('repos:getTerminalGitAccountWarnings', () => {
  const repo = { id: 'r1', path: '/work/app' }
  beforeEach(() => {
    mocks.handlers.clear()
    mocks.warnings.mockReset().mockResolvedValue(['gh token is in a file'])
    mocks.gitOptions.mockReset().mockReturnValue({})
    const store = { getRepo: (id: string) => (id === 'r1' ? repo : undefined) }
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the handler reads only getRepo.
    registerTerminalGitAccountHandlers(store as unknown as Store)
  })

  const ask = (args: unknown): unknown =>
    mocks.handlers.get('repos:getTerminalGitAccountWarnings')!({}, args)

  it("reports for the gh that the project's WSL terminals run", async () => {
    mocks.gitOptions.mockReturnValue({ wslDistro: 'Ubuntu' })
    await expect(ask({ repoId: 'r1' })).resolves.toEqual(['gh token is in a file'])
    expect(mocks.warnings).toHaveBeenCalledWith(repo, { distro: 'Ubuntu' })
  })

  it('returns nothing for an unknown project', async () => {
    await expect(ask({ repoId: 'nope' })).resolves.toEqual([])
    expect(mocks.warnings).not.toHaveBeenCalled()
  })
})
