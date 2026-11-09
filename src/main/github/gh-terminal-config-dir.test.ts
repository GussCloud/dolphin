import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  classifyGhTokenStorage,
  ensureGhTerminalConfigDir,
  ghTerminalConfigDir
} from './gh-terminal-config-dir'

const binding = { host: 'github.com', user: 'alice' }

describe('gh terminal config dir', () => {
  const roots: string[] = []
  afterEach(() => {
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('names only the bound login, as the active https user, with no token', () => {
    const root = mkdtempSync(join(tmpdir(), 'dolphin-gh-terminal-'))
    roots.push(root)
    const dir = ensureGhTerminalConfigDir(binding, root)
    expect(dir).toBe(join(root, 'gh-accounts', 'github.com', 'alice'))
    const hosts = readFileSync(join(dir, 'hosts.yml'), 'utf8')
    expect(hosts).toBe(
      '"github.com":\n    git_protocol: https\n    users:\n        "alice":\n    user: "alice"\n'
    )
    expect(hosts).not.toContain('oauth_token')
  })

  it('keeps a login that looks like a path inside its own folder', () => {
    expect(ghTerminalConfigDir({ host: 'ghe.corp', user: '../x' }, '/u')).toBe(
      join('/u', 'gh-accounts', 'ghe.corp', '..%2Fx')
    )
  })
})

describe('classifyGhTokenStorage', () => {
  it('reports keyring when the login is listed without a token', () => {
    expect(
      classifyGhTokenStorage(
        'github.com:\n  users:\n    alice:\n    bob:\n      oauth_token: x\n  user: alice\n',
        binding
      )
    ).toBe('keyring')
  })

  it('reports file when that login keeps its token in hosts.yml, in either layout', () => {
    expect(
      classifyGhTokenStorage('github.com:\n  users:\n    alice:\n      oauth_token: x\n', binding)
    ).toBe('file')
    expect(classifyGhTokenStorage('github.com:\n  user: alice\n  oauth_token: x\n', binding)).toBe(
      'file'
    )
  })

  it('reports missing for another host or login, and unknown for garbage', () => {
    expect(classifyGhTokenStorage('ghe.corp:\n  user: alice\n', binding)).toBe('missing')
    expect(classifyGhTokenStorage('github.com:\n  users:\n    bob:\n', binding)).toBe('missing')
    expect(classifyGhTokenStorage(':\n  - [', binding)).toBe('unknown')
  })
})
