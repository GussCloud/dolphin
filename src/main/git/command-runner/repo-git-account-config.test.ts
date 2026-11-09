import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  azureDevOpsGitUrls,
  remoteUrlCandidatesFromGitConfig,
  buildRepoGitAccountInvocation,
  mergeRepoGitAccountEnv,
  needsGitCredentialGrants,
  type GitCredentialGrant
} from './repo-git-account-config'

const TOKEN = 'gho_secretTokenValue123'
const githubGrant: GitCredentialGrant = {
  kind: 'token',
  urls: ['https://github.com'],
  username: 'alice',
  token: TOKEN
}

describe('buildRepoGitAccountInvocation', () => {
  it('scopes the credential helper to the bound https host and keeps the token out of argv', () => {
    const invocation = buildRepoGitAccountInvocation({
      args: ['push', 'origin', 'HEAD'],
      context: { ghAccount: { host: 'github.com', user: 'alice' } },
      grants: [githubGrant]
    })
    expect(invocation.leadingArgs.slice(0, 2)).toEqual([
      '-c',
      'credential.https://github.com.helper='
    ])
    expect(invocation.leadingArgs[3]).toMatch(/^credential\.https:\/\/github\.com\.helper=!f\(\)/)
    expect(invocation.leadingArgs.join(' ')).not.toContain(TOKEN)
    expect(invocation.env).toEqual({
      DOLPHIN_GIT_CREDENTIAL_0_USERNAME: 'alice',
      DOLPHIN_GIT_CREDENTIAL_0_PASSWORD: TOKEN
    })
  })

  it('scopes Azure DevOps to dev.azure.com plus the concrete visualstudio.com hosts, never a wildcard', () => {
    const urls = azureDevOpsGitUrls([
      'https://myorg@myorg.visualstudio.com/Project/_git/repo',
      'https://dev.azure.com/acme/Project/_git/repo',
      'git@ssh.dev.azure.com:v3/acme/Project/repo',
      'https://github.com/acme/repo.git',
      'http://plain.visualstudio.com/x'
    ])
    expect(urls).toEqual(['https://dev.azure.com', 'https://myorg.visualstudio.com'])
    expect(
      remoteUrlCandidatesFromGitConfig(
        'remote.origin.url ado:P/_git/r\nurl.https://MyOrg.visualstudio.com/.insteadof ado:\n'
      )
    ).toEqual(['ado:P/_git/r', 'https://MyOrg.visualstudio.com/'])
    const invocation = buildRepoGitAccountInvocation({
      args: ['fetch', '--prune'],
      context: { azureDevOpsAccountId: 'acct1' },
      grants: [{ kind: 'token', urls, username: 'dolphin', token: 'ey.jwt' }]
    })
    const keys = invocation.leadingArgs.filter((arg) => arg.endsWith('.helper='))
    expect(keys).toEqual([
      'credential.https://dev.azure.com.helper=',
      'credential.https://myorg.visualstudio.com.helper='
    ])
    expect(invocation.leadingArgs.join(' ')).not.toContain('*')
  })

  it('adds no credential config to commands that never reach a remote', () => {
    const invocation = buildRepoGitAccountInvocation({
      args: ['status', '--porcelain'],
      context: { ghAccount: { host: 'github.com', user: 'alice' } },
      grants: [githubGrant]
    })
    expect(invocation).toEqual({ leadingArgs: [], env: {} })
    expect(
      needsGitCredentialGrants(['status'], { ghAccount: { host: 'github.com', user: 'a' } })
    ).toBe(false)
    expect(needsGitCredentialGrants(['-C', '/r', 'fetch'], { azureDevOpsAccountId: 'a' })).toBe(
      true
    )
    expect(needsGitCredentialGrants(['submodule', 'update'], { azureDevOpsAccountId: 'a' })).toBe(
      true
    )
  })

  it('turns a token that could forge credential-protocol lines into a fail-closed helper', () => {
    const invocation = buildRepoGitAccountInvocation({
      args: ['push'],
      context: { ghAccount: { host: 'github.com', user: 'alice' } },
      grants: [{ ...githubGrant, token: 'tok\npassword=evil' }]
    })
    expect(invocation.leadingArgs[3]).toContain('quit=1')
    expect(Object.values(invocation.env).join(' ')).not.toContain('evil')
  })

  it('pins author identity only for commit-creating commands', () => {
    const context = { commitIdentity: { name: 'Ana Dev', email: 'ana@corp.example' } }
    expect(
      buildRepoGitAccountInvocation({ args: ['commit', '-m', 'x'], context, grants: [] })
        .leadingArgs
    ).toEqual(['-c', 'user.name=Ana Dev', '-c', 'user.email=ana@corp.example'])
    expect(
      buildRepoGitAccountInvocation({ args: ['push'], context, grants: [] }).leadingArgs
    ).toEqual([])
    expect(
      buildRepoGitAccountInvocation({ args: ['rebase', 'main'], context, grants: [] }).leadingArgs
    ).toHaveLength(4)
  })

  it('drops an identity that would inject extra git config', () => {
    const invocation = buildRepoGitAccountInvocation({
      args: ['commit', '-m', 'x'],
      context: { commitIdentity: { name: 'Ana\n[core]', email: 'ana@corp.example' } },
      grants: []
    })
    expect(invocation.leadingArgs).toEqual([])
  })

  it('registers the credential vars in WSLENV on Windows only', () => {
    const vars = { DOLPHIN_GIT_CREDENTIAL_0_PASSWORD: TOKEN }
    expect(mergeRepoGitAccountEnv({ WSLENV: 'FOO' }, vars, 'win32').WSLENV).toBe(
      'FOO:DOLPHIN_GIT_CREDENTIAL_0_PASSWORD'
    )
    expect(mergeRepoGitAccountEnv({ WSLENV: 'FOO' }, vars, 'darwin').WSLENV).toBe('FOO')
  })
})

describe('credential helper against real git', () => {
  const tempPaths: string[] = []
  afterEach(() => {
    for (const path of tempPaths.splice(0)) {
      rmSync(path, { recursive: true, force: true })
    }
  })

  /** Isolated HOME whose global helper records every call, like osxkeychain/GCM would answer. */
  function isolatedGit(): {
    fill: (
      host: string,
      extraArgs: string[],
      extraEnv: Record<string, string>
    ) => ReturnType<typeof spawnSync>
    globalCalled: () => boolean
  } {
    const root = mkdtempSync(join(tmpdir(), 'dolphin-git-credential-'))
    tempPaths.push(root)
    const home = join(root, 'home')
    mkdirSync(home)
    const marker = join(root, 'global-helper-called')
    const helper = join(root, 'global-helper.sh')
    writeFileSync(
      helper,
      `#!/bin/sh\necho called >> "${marker}"\necho username=global\necho password=global-secret\n`,
      { mode: 0o755 }
    )
    writeFileSync(join(home, '.gitconfig'), `[credential]\n\thelper = ${helper}\n`)
    return {
      fill: (host, extraArgs, extraEnv) =>
        spawnSync('git', [...extraArgs, 'credential', 'fill'], {
          cwd: root,
          input: `protocol=https\nhost=${host}\n\n`,
          encoding: 'utf8',
          env: {
            PATH: process.env.PATH,
            HOME: home,
            XDG_CONFIG_HOME: join(home, '.config'),
            GIT_CONFIG_NOSYSTEM: '1',
            GIT_TERMINAL_PROMPT: '0',
            ...extraEnv
          }
        }),
      globalCalled: () => existsSync(marker)
    }
  }

  it.skipIf(process.platform === 'win32')(
    'answers with the project token and never consults the global helper for the bound host',
    () => {
      const git = isolatedGit()
      const invocation = buildRepoGitAccountInvocation({
        args: ['fetch'],
        context: { ghAccount: { host: 'github.com', user: 'alice' } },
        grants: [githubGrant]
      })
      const result = git.fill('github.com', invocation.leadingArgs, invocation.env)
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('username=alice\n')
      expect(result.stdout).toContain(`password=${TOKEN}\n`)
      expect(git.globalCalled()).toBe(false)
    }
  )

  it.skipIf(process.platform === 'win32')('leaves other hosts on the global helper', () => {
    const git = isolatedGit()
    const invocation = buildRepoGitAccountInvocation({
      args: ['fetch'],
      context: { ghAccount: { host: 'github.com', user: 'alice' } },
      grants: [githubGrant]
    })
    const result = git.fill('dev.azure.com', invocation.leadingArgs, invocation.env)
    expect(result.stdout).toContain('password=global-secret')
    expect(git.globalCalled()).toBe(true)
  })

  it.skipIf(process.platform === 'win32')(
    'fails closed with the Dolphin message instead of falling back to the global login',
    () => {
      const git = isolatedGit()
      const invocation = buildRepoGitAccountInvocation({
        args: ['push'],
        context: { azureDevOpsAccountId: 'gone' },
        grants: [
          {
            kind: 'unavailable',
            urls: azureDevOpsGitUrls(['https://myorg.visualstudio.com/P/_git/r']),
            message: 'Dolphin: account removed'
          }
        ]
      })
      const result = git.fill('myorg.visualstudio.com', invocation.leadingArgs, invocation.env)
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('Dolphin: account removed')
      expect(result.stdout).not.toContain('global-secret')
      expect(git.globalCalled()).toBe(false)
    }
  )
})
