import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const wsl = vi.hoisted(() => ({ run: vi.fn() }))
vi.mock('../wsl/wsl-runner', () => ({ runWslProcess: wsl.run }))

import {
  classifyGhTokenStorage,
  detectGhTokenStorage,
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

describe('detectGhTokenStorage in WSL', () => {
  beforeEach(() => {
    wsl.run.mockReset()
  })

  /** Echoes back the fenced script's markers around `answer`, after an rc banner on stdout. */
  function answerWith(answer: string, code = 0): void {
    wsl.run.mockImplementation(async (spec: { script: string }) => {
      const markers = [...spec.script.matchAll(/__DOLPHIN_WSL_CAPTURE_(?:BEGIN|END)_[^_]+__/g)]
      const begin = markers.find((m) => m[0].includes('BEGIN'))![0]
      const end = markers.find((m) => m[0].includes('END'))![0]
      return {
        code,
        stdout: `To run a command as administrator (user "root"), use "sudo".\n${begin}${answer}\n${end}`,
        stderr: '',
        timedOut: false,
        environmentResolved: true
      }
    })
  }

  it("asks the distro's login shell through the WSL runner and reads only the fenced answer", async () => {
    answerWith('keyring')
    await expect(detectGhTokenStorage(binding, { wsl: { distro: 'Ubuntu' } })).resolves.toBe(
      'keyring'
    )
    expect(wsl.run).toHaveBeenCalledWith(
      expect.objectContaining({ distro: 'Ubuntu', loginPath: 'none' })
    )
  })

  it('reports file storage so the binding stays off terminals', async () => {
    answerWith('file')
    await expect(detectGhTokenStorage(binding, { wsl: { distro: null } })).resolves.toBe('file')
    expect(wsl.run.mock.calls[0]?.[0]).not.toHaveProperty('distro')
  })

  it('treats a failed, unfenced or garbled probe as unknown', async () => {
    answerWith('keyring', 1)
    await expect(detectGhTokenStorage(binding, { wsl: { distro: 'Ubuntu' } })).resolves.toBe(
      'unknown'
    )
    wsl.run.mockResolvedValue({ code: 0, stdout: 'keyring', stderr: '', timedOut: false })
    await expect(detectGhTokenStorage(binding, { wsl: { distro: 'Ubuntu' } })).resolves.toBe(
      'unknown'
    )
    wsl.run.mockRejectedValue(new Error('wsl.exe missing'))
    await expect(detectGhTokenStorage(binding, { wsl: { distro: 'Ubuntu' } })).resolves.toBe(
      'unknown'
    )
  })
})
