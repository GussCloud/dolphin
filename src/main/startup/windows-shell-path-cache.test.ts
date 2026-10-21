import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  WINDOWS_SHELL_PATH_CACHE_FILE,
  createWindowsShellPathCache
} from './windows-shell-path-cache'

describe('Windows shell PATH cache', () => {
  let userDataPath: string
  let cachePath: string

  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'dolphin-shell-path-cache-'))
    cachePath = join(userDataPath, WINDOWS_SHELL_PATH_CACHE_FILE)
  })

  afterEach(() => {
    rmSync(userDataPath, { recursive: true, force: true })
  })

  it('round-trips the last probed PATH for the same shell and app version', () => {
    createWindowsShellPathCache(userDataPath, '1.2.3').save('pwsh', ['C:\\a', 'C:\\b'])

    expect(createWindowsShellPathCache(userDataPath, '1.2.3').load('pwsh')).toEqual([
      'C:\\a',
      'C:\\b'
    ])
  })

  it('ignores an entry from another app version or shell', () => {
    createWindowsShellPathCache(userDataPath, '1.2.3').save('pwsh', ['C:\\a'])

    expect(createWindowsShellPathCache(userDataPath, '1.2.4').load('pwsh')).toBeNull()
    expect(createWindowsShellPathCache(userDataPath, '1.2.3').load('git-bash')).toBeNull()
  })

  it.each([
    ['not json', '{'],
    ['a non-object', '"C:\\\\a"'],
    [
      'an empty PATH',
      JSON.stringify({ schemeVersion: 1, appVersion: '1', shellKey: 'k', segments: [] })
    ],
    [
      'a non-string segment',
      JSON.stringify({ schemeVersion: 1, appVersion: '1', shellKey: 'k', segments: ['C:\\a', 3] })
    ],
    [
      'an unknown scheme',
      JSON.stringify({ schemeVersion: 99, appVersion: '1', shellKey: 'k', segments: ['C:\\a'] })
    ]
  ])('ignores %s', (_label, contents) => {
    writeFileSync(cachePath, contents)

    expect(createWindowsShellPathCache(userDataPath, '1').load('k')).toBeNull()
  })

  it('returns null when no cache exists', () => {
    expect(createWindowsShellPathCache(userDataPath, '1').load('k')).toBeNull()
  })

  it('skips rewriting the PATH it just loaded', () => {
    createWindowsShellPathCache(userDataPath, '1').save('k', ['C:\\a'])
    const cache = createWindowsShellPathCache(userDataPath, '1')
    cache.load('k')
    rmSync(cachePath)

    cache.save('k', ['C:\\a'])
    expect(existsSync(cachePath)).toBe(false)
    cache.save('k', ['C:\\b'])
    expect(cache.load('k')).toEqual(['C:\\b'])
  })
})
