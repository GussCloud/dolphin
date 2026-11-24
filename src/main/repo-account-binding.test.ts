import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repo } from '../shared/repo-types'

const preference = vi.hoisted(() => {
  const state: { method: 'token' | 'azure-cli' } = { method: 'token' }
  return state
})
vi.mock('./azure-devops/azure-devops-auth-preference-store', () => ({
  getAzureDevOpsAuthPreference: () => ({ method: preference.method, autoRenewCliSession: true })
}))
const tokens = vi.hoisted(() => ({ azureCli: vi.fn(), managedAzure: vi.fn() }))
vi.mock('./azure-devops/azure-cli-access-token', () => ({
  getAzureCliAccessToken: tokens.azureCli
}))
vi.mock('./azure-devops/azure-devops-account-scope', () => ({
  resolveAzureDevOpsAccountToken: tokens.managedAzure
}))
import { RepoClone, RepoUpdate } from '../shared/rpc-contract/repo-params'
import { getRepoGitAccountContext } from './project-runtime-git-options'
import { applyRepoAccountBindingToNewRepo, prepareCloneGitInvocation } from './repo-account-binding'

const identity = { name: 'Ana Dev', email: 'ana@corp.example' }

function repo(overrides: Partial<Repo> = {}): Repo {
  return {
    id: 'r1',
    path: '/work/app',
    displayName: 'app',
    badgeColor: '#000',
    addedAt: 0,
    ...overrides
  }
}

describe('getRepoGitAccountContext', () => {
  beforeEach(() => {
    preference.method = 'token'
  })

  it('carries every binding of a local repo', () => {
    expect(
      getRepoGitAccountContext(
        repo({
          ghAccount: { host: 'github.com', user: 'alice' },
          azureDevOpsAccountId: 'acct',
          commitIdentity: identity
        })
      )
    ).toEqual({
      ghAccount: { host: 'github.com', user: 'alice' },
      azureDevOpsAccountId: 'acct',
      commitIdentity: identity
    })
    expect(getRepoGitAccountContext(repo())).toBeUndefined()
  })

  it('marks "Default sign-in" for the global az login only when Azure DevOps auth uses the CLI', () => {
    const azureRemote = {
      canonicalKey: 'dev.azure.com/evup/p/app',
      remoteName: 'origin',
      remoteUrl: 'https://evup@dev.azure.com/evup/P/_git/app'
    }
    expect(getRepoGitAccountContext(repo({ gitRemoteIdentity: azureRemote }))).toBeUndefined()

    preference.method = 'azure-cli'
    expect(getRepoGitAccountContext(repo({ gitRemoteIdentity: azureRemote }))).toEqual({
      azureDevOpsDefaultCliSignIn: true
    })
    // Unknown remote: decided per git call from the remotes git reads.
    expect(getRepoGitAccountContext(repo())).toEqual({ azureDevOpsDefaultCliSignIn: true })
    expect(
      getRepoGitAccountContext(
        repo({
          gitRemoteIdentity: { ...azureRemote, remoteUrl: 'https://github.com/acme/app.git' }
        })
      )
    ).toBeUndefined()
    expect(getRepoGitAccountContext(repo({ azureDevOpsAccountId: 'acct' }))).toEqual({
      azureDevOpsAccountId: 'acct'
    })
    expect(getRepoGitAccountContext(repo({ kind: 'folder' }))).toBeUndefined()
    expect(getRepoGitAccountContext(repo({ connectionId: 'box' }))).toBeUndefined()
  })

  it('injects nothing for SSH repos, whose git runs in the remote relay', () => {
    expect(
      getRepoGitAccountContext(repo({ connectionId: 'box', commitIdentity: identity }))
    ).toBeUndefined()
  })
})

describe('applyRepoAccountBindingToNewRepo', () => {
  it('stores only valid choices through the host-scoped update path', () => {
    const updateRepo = vi.fn(() => repo({ commitIdentity: identity }))
    applyRepoAccountBindingToNewRepo({ updateRepo }, repo(), {
      commitIdentity: { name: ' Ana Dev ', email: 'ana@corp.example' },
      azureDevOpsAccountId: '../escape'
    })
    expect(updateRepo).toHaveBeenCalledWith(
      'r1',
      { commitIdentity: identity, accountSetupReviewedAt: expect.any(Number) },
      'local'
    )
  })

  it('stores the project agent account chosen at add time', () => {
    const updateRepo = vi.fn(() => repo({ claudeAccountId: 'acct-company' }))
    applyRepoAccountBindingToNewRepo({ updateRepo }, repo(), { claudeAccountId: 'acct-company' })
    expect(updateRepo).toHaveBeenCalledWith(
      'r1',
      { claudeAccountId: 'acct-company', accountSetupReviewedAt: expect.any(Number) },
      'local'
    )
  })

  it('only marks the accounts reviewed when nothing usable was chosen', () => {
    const updateRepo = vi.fn(() => null)
    const created = repo()
    expect(applyRepoAccountBindingToNewRepo({ updateRepo }, created, { commitIdentity: {} })).toBe(
      created
    )
    expect(updateRepo).toHaveBeenCalledWith(
      'r1',
      { accountSetupReviewedAt: expect.any(Number) },
      'local'
    )
  })
})

describe('prepareCloneGitInvocation', () => {
  const AZURE_URL = 'https://evup@dev.azure.com/evup/P/_git/app'
  let cwd: string
  let env: NodeJS.ProcessEnv

  beforeEach(() => {
    preference.method = 'azure-cli'
    tokens.azureCli.mockReset().mockResolvedValue('az-token')
    tokens.managedAzure.mockReset().mockResolvedValue('managed-token')
    cwd = mkdtempSync(join(tmpdir(), 'dolphin-clone-account-'))
    // Why an empty HOME: the remote/insteadOf read must not see the developer's global git config.
    env = { PATH: process.env.PATH, HOME: cwd, GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' }
  })
  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true })
  })

  function clone(url: string, binding: unknown) {
    return prepareCloneGitInvocation(['clone', '--progress', '--', url, join(cwd, 'app')], {
      cwd,
      env,
      url,
      binding
    })
  }

  it('uses the global az login for an Azure DevOps https clone with no account chosen', async () => {
    for (const binding of [undefined, {}]) {
      const invocation = await clone(AZURE_URL, binding)
      expect(invocation.args).toContain('credential.https://dev.azure.com.helper=')
      expect(invocation.args.join(' ')).not.toContain('az-token')
      expect(Object.values(invocation.env)).toContain('az-token')
    }
    expect(tokens.azureCli).toHaveBeenCalledTimes(2)
  })

  it("still clones on git's own credentials when the az token is unavailable", async () => {
    tokens.azureCli.mockRejectedValue(new Error('az login required'))
    const args = ['clone', '--progress', '--', AZURE_URL, join(cwd, 'app')]
    await expect(clone(AZURE_URL, undefined)).resolves.toEqual({ args, env })
  })

  it('keeps a chosen managed Azure DevOps account instead of the global az login', async () => {
    const invocation = await clone(AZURE_URL, { azureDevOpsAccountId: 'acct' })
    expect(Object.values(invocation.env)).toContain('managed-token')
    expect(Object.values(invocation.env)).not.toContain('az-token')
    expect(tokens.azureCli).not.toHaveBeenCalled()
  })

  it('leaves non-Azure clones and non-CLI preferences untouched', async () => {
    const githubUrl = 'https://github.com/acme/app.git'
    await expect(clone(githubUrl, undefined)).resolves.toEqual({
      args: ['clone', '--progress', '--', githubUrl, join(cwd, 'app')],
      env
    })
    preference.method = 'token'
    await expect(clone(AZURE_URL, undefined)).resolves.toEqual({
      args: ['clone', '--progress', '--', AZURE_URL, join(cwd, 'app')],
      env
    })
    expect(tokens.azureCli).not.toHaveBeenCalled()
  })
})

describe('wire params', () => {
  it('keeps clone requests from older clients valid and normalizes the new binding', () => {
    expect(RepoClone.parse({ url: 'u', destination: 'd' }).accountBinding).toBeUndefined()
    expect(
      RepoClone.parse({
        url: 'u',
        destination: 'd',
        accountBinding: { azureDevOpsAccountId: 'a1' }
      }).accountBinding
    ).toEqual({ azureDevOpsAccountId: 'a1' })
  })

  it('treats null as clear and a malformed value as absent on repo.update', () => {
    const cleared = RepoUpdate.parse({ repo: 'r1', updates: { commitIdentity: null } })
    expect(cleared.updates.commitIdentity).toBeNull()
    const malformed = RepoUpdate.parse({
      repo: 'r1',
      updates: { azureDevOpsAccountId: '../x', commitIdentity: { name: 'x', email: 'bad' } }
    })
    expect(malformed.updates.azureDevOpsAccountId).toBeUndefined()
    expect(malformed.updates.commitIdentity).toBeUndefined()
  })
})
