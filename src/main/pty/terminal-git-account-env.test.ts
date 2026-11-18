import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../shared/repo-types'

const mocks = vi.hoisted(() => ({
  readReachableUrls: vi.fn(),
  detectGhTokenStorage: vi.fn(),
  ensureGhTerminalConfigDir: vi.fn(),
  findAccount: vi.fn(),
  authMethod: 'token' as 'token' | 'azure-cli'
}))

vi.mock('../git/command-runner/repo-git-account-env', () => ({
  readReachableUrls: mocks.readReachableUrls
}))
vi.mock('../github/gh-terminal-config-dir', () => ({
  detectGhTokenStorage: mocks.detectGhTokenStorage,
  ensureGhTerminalConfigDir: mocks.ensureGhTerminalConfigDir
}))
vi.mock('../azure-devops/azure-devops-managed-accounts', () => ({
  findAzureDevOpsManagedAccount: mocks.findAccount,
  azureDevOpsAccountConfigDir: (account: { configDirName: string }) =>
    `/ud/ado/${account.configDirName}`
}))

vi.mock('../azure-devops/azure-devops-auth-preference-store', () => ({
  getAzureDevOpsAuthPreference: () => ({ method: mocks.authMethod, autoRenewCliSession: true })
}))

import {
  applyTerminalGitAccountEnv,
  applyTerminalGitAccountForSpawn,
  buildTerminalGitAccountEnv,
  installTerminalGitAccountRepoLookup
} from './terminal-git-account-env'

const identity = { name: 'Ana Dev', email: 'ana@corp.example' }

function repo(overrides: Partial<Repo> = {}): Repo {
  return {
    id: 'r1',
    path: '/work/app',
    displayName: 'app',
    badgeColor: '#000',
    addedAt: 0,
    kind: 'git',
    ...overrides
  }
}

describe('buildTerminalGitAccountEnv', () => {
  beforeEach(() => {
    mocks.readReachableUrls.mockReset().mockResolvedValue(['https://GitHub.com/acme/app.git'])
    mocks.detectGhTokenStorage.mockReset().mockResolvedValue('keyring')
    mocks.ensureGhTerminalConfigDir.mockReset().mockReturnValue('/ud/gh-accounts/github.com/alice')
    mocks.findAccount.mockReset()
    mocks.authMethod = 'token'
  })

  it('points gh at the token-free account dir and scopes git to it, with no token anywhere', async () => {
    const patch = await buildTerminalGitAccountEnv({
      repo: repo({ ghAccount: { host: 'github.com', user: 'alice' }, commitIdentity: identity }),
      cwd: '/work/app',
      inheritedGitConfigParameters: "'core.editor=vim'",
      ambientEnv: { GH_TOKEN: 'ambient-token', GITHUB_TOKEN: '' }
    })
    expect(patch?.env.GH_CONFIG_DIR).toBe('/ud/gh-accounts/github.com/alice')
    // Only the ambient token that is set gets neutralized; absent ones are not added.
    expect(patch?.env.GH_TOKEN).toBe('')
    expect('GITHUB_TOKEN' in (patch?.env ?? {})).toBe(false)
    expect(patch?.env.GIT_CONFIG_PARAMETERS).toBe(
      [
        "'core.editor=vim'",
        "'credential.https://github.com.helper='",
        "'credential.https://github.com.helper=!gh auth git-credential'",
        "'credential.https://GitHub.com.helper='",
        "'credential.https://GitHub.com.helper=!gh auth git-credential'",
        "'user.name=Ana Dev'",
        "'user.email=ana@corp.example'"
      ].join(' ')
    )
    expect(patch?.warnings).toEqual([])
  })

  it('skips GitHub with a visible warning when gh keeps the token in a file', async () => {
    mocks.detectGhTokenStorage.mockResolvedValue('file')
    const patch = await buildTerminalGitAccountEnv({
      repo: repo({ ghAccount: { host: 'github.com', user: 'alice' } }),
      cwd: '/work/app'
    })
    expect(patch?.env).toEqual({})
    expect(patch?.warnings[0]).toContain('instead of the system keyring')
    expect(patch?.warnings[0]).toContain('gh auth login --hostname github.com')
    expect(patch?.warnings[0]).not.toContain('--secure-storage')
    expect(mocks.ensureGhTerminalConfigDir).not.toHaveBeenCalled()
  })

  it('fetches the Azure DevOps token with az at credential time, never in the env', async () => {
    mocks.readReachableUrls.mockResolvedValue(['https://myorg.visualstudio.com/P/_git/app'])
    mocks.findAccount.mockReturnValue({ id: 'a1', login: 'ana@corp', configDirName: 'cfg1' })
    const patch = await buildTerminalGitAccountEnv({
      repo: repo({ azureDevOpsAccountId: 'a1' }),
      cwd: '/work/app'
    })
    const params = patch?.env.GIT_CONFIG_PARAMETERS ?? ''
    expect(params).toContain("'credential.https://dev.azure.com.helper='")
    expect(params).toContain("'credential.https://myorg.visualstudio.com.helper=")
    expect(params).toContain("AZURE_CONFIG_DIR='\\''/ud/ado/cfg1'\\'' az account get-access-token")
    expect(Object.keys(patch?.env ?? {})).toEqual(['GIT_CONFIG_PARAMETERS'])
  })

  it('fails closed for Azure DevOps when the account is gone or the shell is WSL', async () => {
    const gone = await buildTerminalGitAccountEnv({
      repo: repo({ azureDevOpsAccountId: 'gone' }),
      cwd: '/work/app'
    })
    expect(gone?.env.GIT_CONFIG_PARAMETERS).toContain('quit=1')
    expect(gone?.warnings[0]).toContain('was removed')

    mocks.findAccount.mockReturnValue({ id: 'a1', login: 'x', configDirName: 'c' })
    const wsl = await buildTerminalGitAccountEnv({
      repo: repo({ azureDevOpsAccountId: 'a1' }),
      cwd: '/work/app',
      wsl: { distro: 'Ubuntu' }
    })
    expect(wsl?.env.GIT_CONFIG_PARAMETERS).toContain('not available in WSL terminals')
    expect(wsl?.env.GIT_CONFIG_PARAMETERS).not.toContain('az account')
  })

  it('leaves SSH and unbound repos alone', async () => {
    expect(
      await buildTerminalGitAccountEnv({
        repo: repo({ connectionId: 'box', commitIdentity: identity }),
        cwd: '/x'
      })
    ).toBeNull()
    expect(await buildTerminalGitAccountEnv({ repo: repo(), cwd: '/x' })).toBeNull()
  })

  it('uses the global az login for an Azure DevOps remote on "Default sign-in"', async () => {
    mocks.authMethod = 'azure-cli'
    mocks.readReachableUrls.mockResolvedValue(['https://evup@dev.azure.com/evup/P/_git/app'])
    const patch = await buildTerminalGitAccountEnv({ repo: repo(), cwd: '/work/app' })
    const params = patch?.env.GIT_CONFIG_PARAMETERS ?? ''
    expect(params).toContain("'credential.https://dev.azure.com.helper='")
    expect(params).toContain('az account get-access-token')
    expect(params).not.toContain('AZURE_CONFIG_DIR')
    expect(params).toContain('git credential fill')
    expect(patch?.warnings).toEqual([])
  })

  it('leaves "Default sign-in" alone off the Azure CLI, off Azure remotes, and in WSL', async () => {
    mocks.readReachableUrls.mockResolvedValue(['https://dev.azure.com/evup/P/_git/app'])
    expect(await buildTerminalGitAccountEnv({ repo: repo(), cwd: '/x' })).toBeNull()

    mocks.authMethod = 'azure-cli'
    expect(
      await buildTerminalGitAccountEnv({ repo: repo(), cwd: '/x', wsl: { distro: null } })
    ).toBeNull()
    expect(
      await buildTerminalGitAccountEnv({
        repo: repo({
          gitRemoteIdentity: {
            canonicalKey: 'github.com/acme/app',
            remoteName: 'origin',
            remoteUrl: 'https://github.com/acme/app.git'
          }
        }),
        cwd: '/x'
      })
    ).toBeNull()

    mocks.readReachableUrls.mockResolvedValue(['git@ssh.dev.azure.com:v3/evup/P/app'])
    expect(await buildTerminalGitAccountEnv({ repo: repo(), cwd: '/x' })).toBeNull()

    mocks.readReachableUrls.mockRejectedValue(new Error('unreadable'))
    expect(await buildTerminalGitAccountEnv({ repo: repo(), cwd: '/x' })).toBeNull()
  })

  it('registers the vars in WSLENV, translating the gh dir path', () => {
    const env: Record<string, string> = { WSLENV: 'FOO' }
    applyTerminalGitAccountEnv(
      env,
      { env: { GH_CONFIG_DIR: 'C:\\ud\\gh', GIT_CONFIG_PARAMETERS: "'a=b'" }, warnings: [] },
      { isWsl: true }
    )
    expect(env.WSLENV).toBe('FOO:GH_CONFIG_DIR/p:GIT_CONFIG_PARAMETERS')
  })
})

describe('applyTerminalGitAccountForSpawn', () => {
  beforeEach(() => {
    mocks.readReachableUrls.mockReset().mockResolvedValue([])
    installTerminalGitAccountRepoLookup({
      getRepos: () => [repo({ commitIdentity: identity })],
      getAllWorktreeMeta: () => ({})
    })
  })

  it('applies the project of the spawning worktree and never touches SSH spawns', async () => {
    const env: Record<string, string> = {}
    await applyTerminalGitAccountForSpawn(env, { worktreeId: 'r1::/work/wt', cwd: '/work/wt' })
    expect(env.GIT_CONFIG_PARAMETERS).toBe("'user.name=Ana Dev' 'user.email=ana@corp.example'")

    const ssh: Record<string, string> = {}
    await applyTerminalGitAccountForSpawn(ssh, {
      connectionId: 'box',
      worktreeId: 'r1::/work/wt'
    })
    expect(ssh).toEqual({})
  })
})
