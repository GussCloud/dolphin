import { beforeEach, describe, expect, it, vi } from 'vitest'

const { ghExecFileAsync } = vi.hoisted(() => ({ ghExecFileAsync: vi.fn() }))
vi.mock('./gh-utils', () => ({
  acquire: vi.fn(async () => {}),
  release: vi.fn(),
  ghExecFileAsync
}))

import { getGhAccountProfile, switchGhActiveAccount } from './gh-account-profile'

beforeEach(() => {
  ghExecFileAsync.mockReset()
})

describe('switchGhActiveAccount', () => {
  it('runs gh auth switch with flag=value args so a login cannot be read as a flag', async () => {
    ghExecFileAsync.mockResolvedValue({ stdout: '', stderr: '' })
    await expect(switchGhActiveAccount({ host: 'GitHub.com', user: '-ana' })).resolves.toBe(true)
    expect(ghExecFileAsync).toHaveBeenCalledWith(
      ['auth', 'switch', '--hostname=github.com', '--user=-ana'],
      { encoding: 'utf-8' }
    )
  })

  it('reports false when gh refuses, and never runs for a malformed binding', async () => {
    ghExecFileAsync.mockRejectedValue(new Error('not logged in'))
    await expect(switchGhActiveAccount({ host: 'github.com', user: 'ana' })).resolves.toBe(false)
    ghExecFileAsync.mockClear()
    await expect(switchGhActiveAccount({ host: 'bad host', user: 'ana' })).resolves.toBe(false)
    expect(ghExecFileAsync).not.toHaveBeenCalled()
  })
})

describe('getGhAccountProfile', () => {
  it("reads the profile with the account's own token", async () => {
    ghExecFileAsync.mockResolvedValue({ stdout: '{"login":"ana","name":null,"email":null,"id":7}' })
    await expect(getGhAccountProfile({ host: 'github.com', user: 'ana' })).resolves.toEqual({
      login: 'ana',
      name: null,
      email: null,
      id: 7,
      host: 'github.com'
    })
    expect(ghExecFileAsync.mock.calls[0]?.[1]).toMatchObject({
      host: 'github.com',
      ghAccount: { host: 'github.com', user: 'ana' }
    })
  })
})
