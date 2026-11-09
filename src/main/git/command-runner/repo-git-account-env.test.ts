import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { resolveGhAccountTokenMock, resolveAzureDevOpsAccountTokenMock } = vi.hoisted(() => ({
  resolveGhAccountTokenMock: vi.fn(),
  resolveAzureDevOpsAccountTokenMock: vi.fn()
}))

vi.mock('../../github/gh-account-token', () => ({
  resolveGhAccountToken: resolveGhAccountTokenMock
}))
vi.mock('../../azure-devops/azure-devops-account-scope', () => ({
  resolveAzureDevOpsAccountToken: resolveAzureDevOpsAccountTokenMock
}))

import { prepareRepoGitAccountInvocation } from './repo-git-account-env'
import { gitExecFileAsync } from './git-exec-file'

describe('prepareRepoGitAccountInvocation', () => {
  const repoPaths: string[] = []
  beforeEach(() => {
    resolveGhAccountTokenMock.mockReset()
    resolveAzureDevOpsAccountTokenMock.mockReset()
  })
  afterEach(() => {
    for (const path of repoPaths.splice(0)) {
      rmSync(path, { recursive: true, force: true })
    }
  })

  function repoWithRemotes(remotes: Record<string, string>): string {
    const repoPath = mkdtempSync(join(tmpdir(), 'dolphin-account-remotes-'))
    repoPaths.push(repoPath)
    execFileSync('git', ['init', '--quiet'], { cwd: repoPath })
    for (const [name, url] of Object.entries(remotes)) {
      execFileSync('git', ['remote', 'add', name, url], { cwd: repoPath })
    }
    return repoPath
  }

  it('returns null and resolves no token for an unbound repo', async () => {
    await expect(prepareRepoGitAccountInvocation(['push'], { cwd: '/r' })).resolves.toBeNull()
    expect(resolveGhAccountTokenMock).not.toHaveBeenCalled()
  })

  it('does not resolve tokens for commands that never reach a remote', async () => {
    const result = await prepareRepoGitAccountInvocation(['status'], {
      cwd: '/r',
      repoAccount: { ghAccount: { host: 'github.com', user: 'alice' }, azureDevOpsAccountId: 'a1' }
    })
    expect(result).toBeNull()
    expect(resolveGhAccountTokenMock).not.toHaveBeenCalled()
    expect(resolveAzureDevOpsAccountTokenMock).not.toHaveBeenCalled()
  })

  it('injects each bound token for its own host on a network command', async () => {
    resolveGhAccountTokenMock.mockResolvedValue('gh-token')
    resolveAzureDevOpsAccountTokenMock.mockResolvedValue('ado-token')
    const cwd = repoWithRemotes({
      origin: 'https://github.com/acme/app.git',
      company: 'https://myorg@myorg.visualstudio.com/Project/_git/app'
    })
    const result = await prepareRepoGitAccountInvocation(['fetch', 'origin'], {
      cwd,
      env: { PATH: process.env.PATH, MARKER: '1' },
      repoAccount: { ghAccount: { host: 'github.com', user: 'alice' }, azureDevOpsAccountId: 'a1' }
    })
    expect(resolveGhAccountTokenMock).toHaveBeenCalledWith(
      { host: 'github.com', user: 'alice' },
      { cwd, wslDistro: undefined }
    )
    expect(resolveAzureDevOpsAccountTokenMock).toHaveBeenCalledWith('a1')
    expect(result?.args.slice(-2)).toEqual(['fetch', 'origin'])
    expect(result?.args.join(' ')).not.toMatch(/gh-token|ado-token/)
    expect(result?.args).toContain('credential.https://myorg.visualstudio.com.helper=')
    expect(result?.args.join(' ')).not.toContain('*')
    expect(result?.env).toMatchObject({
      MARKER: '1',
      DOLPHIN_GIT_CREDENTIAL_0_PASSWORD: 'gh-token',
      DOLPHIN_GIT_CREDENTIAL_1_PASSWORD: 'ado-token'
    })
  })

  it('fails closed for the bound host when its account cannot produce a token', async () => {
    resolveAzureDevOpsAccountTokenMock.mockRejectedValue(new Error('account was removed'))
    const result = await prepareRepoGitAccountInvocation(['push'], {
      cwd: repoWithRemotes({ origin: 'https://dev.azure.com/acme/P/_git/app' }),
      repoAccount: { azureDevOpsAccountId: 'gone' }
    })
    expect(result?.args.find((arg) => arg.includes('dev.azure.com.helper=!'))).toContain('quit=1')
    expect(result?.env?.DOLPHIN_GIT_CREDENTIAL_0_ERROR).toContain('account was removed')
    expect(result?.env?.DOLPHIN_GIT_CREDENTIAL_0_PASSWORD).toBeUndefined()
  })

  it('scopes a clone to the host of the URL being cloned', async () => {
    resolveAzureDevOpsAccountTokenMock.mockResolvedValue('ado-token')
    const result = await prepareRepoGitAccountInvocation(
      ['clone', '--progress', '--', 'https://neworg.visualstudio.com/P/_git/app', '/dest/app'],
      { cwd: repoWithRemotes({}), repoAccount: { azureDevOpsAccountId: 'a1' } }
    )
    expect(result?.args).toContain('credential.https://neworg.visualstudio.com.helper=')
  })

  it('follows insteadOf rewrites to the visualstudio.com host git will actually contact', async () => {
    resolveAzureDevOpsAccountTokenMock.mockResolvedValue('ado-token')
    const cwd = repoWithRemotes({ origin: 'ado:Project/_git/app' })
    execFileSync(
      'git',
      ['config', 'url.https://MyOrg.visualstudio.com/DefaultCollection/.insteadOf', 'ado:'],
      { cwd }
    )
    execFileSync('git', ['config', 'url.https://pushorg.visualstudio.com/.pushInsteadOf', 'ado:'], {
      cwd
    })
    const result = await prepareRepoGitAccountInvocation(['push'], {
      cwd,
      repoAccount: { azureDevOpsAccountId: 'a1' }
    })
    // Why both spellings: Git 2.25 compares credential hosts case-sensitively.
    expect(result?.args).toContain('credential.https://MyOrg.visualstudio.com.helper=')
    expect(result?.args).toContain('credential.https://myorg.visualstudio.com.helper=')
    expect(result?.args).toContain('credential.https://pushorg.visualstudio.com.helper=')
  })

  it('covers a differently cased spelling of the bound GitHub host', async () => {
    resolveGhAccountTokenMock.mockResolvedValue('gh-token')
    const result = await prepareRepoGitAccountInvocation(['fetch'], {
      cwd: repoWithRemotes({ origin: 'https://GitHub.com/acme/app.git' }),
      repoAccount: { ghAccount: { host: 'github.com', user: 'alice' } }
    })
    expect(result?.args).toContain('credential.https://github.com.helper=')
    expect(result?.args).toContain('credential.https://GitHub.com.helper=')
  })

  it('refuses to run when the remotes cannot be read, instead of using the global login', async () => {
    await expect(
      prepareRepoGitAccountInvocation(['push'], {
        cwd: join(tmpdir(), 'dolphin-missing-dir-for-account-test'),
        repoAccount: { azureDevOpsAccountId: 'a1' }
      })
    ).rejects.toMatchObject({ code: 'repo_git_account_remotes_unreadable' })
    expect(resolveAzureDevOpsAccountTokenMock).not.toHaveBeenCalled()
  })
})

describe('gitExecFileAsync with a project commit identity (real git)', () => {
  const tempPaths: string[] = []
  afterEach(() => {
    for (const path of tempPaths.splice(0)) {
      rmSync(path, { recursive: true, force: true })
    }
  })

  it('authors the commit as the project identity, not the repo config', async () => {
    const repoPath = mkdtempSync(join(tmpdir(), 'dolphin-commit-identity-'))
    tempPaths.push(repoPath)
    const git = (...args: string[]): string =>
      execFileSync('git', args, { cwd: repoPath, encoding: 'utf8' })
    git('init', '--quiet')
    git('config', 'user.name', 'Global Person')
    git('config', 'user.email', 'global@example.test')
    git('config', 'commit.gpgSign', 'false')
    git('config', 'core.hooksPath', '.git/no-hooks')

    await gitExecFileAsync(['commit', '--allow-empty', '-m', 'bound'], {
      cwd: repoPath,
      repoAccount: { commitIdentity: { name: 'Project Dev', email: 'dev@project.example' } }
    })
    await gitExecFileAsync(['commit', '--allow-empty', '-m', 'unbound'], { cwd: repoPath })

    expect(git('log', '-1', '--format=%an <%ae>|%cn <%ce>', 'HEAD~1').trim()).toBe(
      'Project Dev <dev@project.example>|Project Dev <dev@project.example>'
    )
    expect(git('log', '-1', '--format=%an <%ae>').trim()).toBe(
      'Global Person <global@example.test>'
    )
  })
})
