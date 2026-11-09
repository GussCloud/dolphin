import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../shared/repo-types'

const mocks = vi.hoisted(() => ({ runAzureCliJson: vi.fn(), preference: vi.fn() }))

vi.mock('./azure-cli-runner', () => ({
  runAzureCliJson: mocks.runAzureCliJson,
  AzureCliCommandError: class extends Error {}
}))
vi.mock('./azure-devops-auth-preference-store', () => ({
  getAzureDevOpsAuthPreference: mocks.preference
}))

import {
  _setAzureDevOpsManagedAccountsRootForTests,
  azureDevOpsAccountConfigDir,
  createPendingAzureDevOpsAccountDir,
  findAzureDevOpsManagedAccount,
  listAzureDevOpsManagedAccounts,
  saveAzureDevOpsManagedAccount
} from './azure-devops-managed-accounts'
import { removeAzureDevOpsManagedAccount } from './azure-devops-managed-account-commands'
import { findRepoForAzureDevOpsRequest } from './azure-devops-repo-account-lookup'
import { AzureDevOpsAccountUnavailableError } from './azure-devops-account-scope'
import { hasAzureDevOpsCredential, resolveAzureDevOpsAuthHeaders } from './azure-devops-credential'
import { clearManagedAzureCliAccessTokenCache } from './azure-cli-access-token'

function repo(overrides: Partial<Repo>): Repo {
  return {
    id: 'r1',
    path: '/work/app',
    displayName: 'app',
    badgeColor: '#000',
    addedAt: 0,
    ...overrides
  }
}

describe('Azure DevOps managed accounts', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'dolphin-ado-accounts-'))
    _setAzureDevOpsManagedAccountsRootForTests(root)
    clearManagedAzureCliAccessTokenCache()
    mocks.runAzureCliJson.mockReset()
    // Why: proves a scoped request never reads the user's own credential preference.
    mocks.preference.mockReset()
  })

  afterEach(() => {
    _setAzureDevOpsManagedAccountsRootForTests(null)
    rmSync(root, { recursive: true, force: true })
  })

  function addAccount(login = 'ana@corp.example') {
    const pending = createPendingAzureDevOpsAccountDir()
    return saveAzureDevOpsManagedAccount({ login, configDirName: pending.configDirName })
  }

  it('persists accounts across a reload of the record file', () => {
    const account = addAccount()
    _setAzureDevOpsManagedAccountsRootForTests(root)
    expect(listAzureDevOpsManagedAccounts()).toEqual([account])
    expect(existsSync(azureDevOpsAccountConfigDir(account))).toBe(true)
  })

  it("authenticates a scoped request with that account's isolated Azure CLI dir only", async () => {
    const account = addAccount()
    mocks.runAzureCliJson.mockResolvedValue({
      accessToken: 'account-token',
      expires_on: 4102444800
    })
    await expect(resolveAzureDevOpsAuthHeaders({ accountId: account.id })).resolves.toEqual({
      Authorization: 'Bearer account-token'
    })
    expect(mocks.runAzureCliJson).toHaveBeenCalledWith(
      expect.arrayContaining(['get-access-token']),
      {
        configDir: azureDevOpsAccountConfigDir(account)
      }
    )
    expect(mocks.preference).not.toHaveBeenCalled()
  })

  it('fails closed, never falling back to the global credential, when the account is gone', async () => {
    mocks.preference.mockReturnValue({ method: 'azure-cli' })
    await expect(resolveAzureDevOpsAuthHeaders({ accountId: 'missing' })).rejects.toBeInstanceOf(
      AzureDevOpsAccountUnavailableError
    )
    await expect(hasAzureDevOpsCredential({ accountId: 'missing' })).resolves.toBe(false)
    expect(mocks.runAzureCliJson).not.toHaveBeenCalled()
    expect(mocks.preference).not.toHaveBeenCalled()
  })

  it('reports a signed-out account as unavailable instead of sending no credentials', async () => {
    const account = addAccount()
    mocks.runAzureCliJson.mockRejectedValue(new Error('Please run az login'))
    await expect(resolveAzureDevOpsAuthHeaders({ accountId: account.id })).rejects.toThrow(
      /ana@corp\.example is signed out/
    )
  })

  it('removing an account deletes its sign-in and unbinds every project using it', () => {
    const account = addAccount()
    const other = addAccount('other@corp.example')
    const repos = [
      repo({ id: 'a', azureDevOpsAccountId: account.id }),
      repo({ id: 'b', azureDevOpsAccountId: other.id }),
      repo({ id: 'c' })
    ]
    const updateRepo = vi.fn((id: string) => repos.find((entry) => entry.id === id) ?? null)
    const result = removeAzureDevOpsManagedAccount(
      { getRepos: () => repos, updateRepo },
      account.id
    )
    expect(result).toEqual({ ok: true, unboundRepoIds: ['a'] })
    expect(updateRepo).toHaveBeenCalledTimes(1)
    expect(updateRepo).toHaveBeenCalledWith('a', { azureDevOpsAccountId: null }, 'local')
    expect(findAzureDevOpsManagedAccount(account.id)).toBeNull()
    expect(existsSync(azureDevOpsAccountConfigDir(account))).toBe(false)
    expect(findAzureDevOpsManagedAccount(other.id)).not.toBeNull()
  })
})

describe('findRepoForAzureDevOpsRequest', () => {
  const local = repo({ id: 'local', path: '/work/app', azureDevOpsAccountId: 'acct' })
  const ssh = repo({ id: 'ssh', path: '/work/app', connectionId: 'box' })
  const store = {
    getRepos: () => [local, ssh],
    getAllWorktreeMeta: () => ({ 'local::/work/worktrees/feature': {} })
  }

  it('resolves the checkout and its registered worktrees on the same host', () => {
    expect(findRepoForAzureDevOpsRequest(store, '/work/app/')?.id).toBe('local')
    expect(findRepoForAzureDevOpsRequest(store, '/work/worktrees/feature')?.id).toBe('local')
    expect(findRepoForAzureDevOpsRequest(store, '/work/app', 'box')?.id).toBe('ssh')
    expect(findRepoForAzureDevOpsRequest(store, '/elsewhere')).toBeUndefined()
  })
})
