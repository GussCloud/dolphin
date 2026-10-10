import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MAIN_COMPILE_CACHE_DIR_NAME,
  pruneStaleMainCompileCacheVersions,
  resolveMainCompileCacheDir,
  startMainCompileCache,
  type MainCompileCacheModuleApi
} from './main-compile-cache'

const STATUS = { FAILED: 0, ENABLED: 1, ALREADY_ENABLED: 2, DISABLED: 3 }

function createModuleApi(status = STATUS.ENABLED) {
  return {
    enableCompileCache: vi.fn<MainCompileCacheModuleApi['enableCompileCache']>(() => ({ status })),
    flushCompileCache: vi.fn<MainCompileCacheModuleApi['flushCompileCache']>(),
    getCompileCacheDir: () => undefined,
    constants: { compileCacheStatus: STATUS }
  }
}

describe('resolveMainCompileCacheDir', () => {
  const base = { appDataPath: join('home', 'appData'), userDataDirName: 'dolphin' }

  it('places the cache under the packaged profile directory', () => {
    expect(resolveMainCompileCacheDir({ ...base, isPackaged: true, env: {} })).toBe(
      join('home', 'appData', 'dolphin', MAIN_COMPILE_CACHE_DIR_NAME)
    )
  })

  it('stays off for dev, E2E, and AppImage launches', () => {
    expect(resolveMainCompileCacheDir({ ...base, isPackaged: false, env: {} })).toBeNull()
    expect(
      resolveMainCompileCacheDir({
        ...base,
        isPackaged: true,
        env: { DOLPHIN_E2E_USER_DATA_DIR: 'e2e' }
      })
    ).toBeNull()
    expect(
      resolveMainCompileCacheDir({ ...base, isPackaged: true, env: { APPIMAGE: '/x.AppImage' } })
    ).toBeNull()
  })
})

describe('startMainCompileCache', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('does nothing without a directory', () => {
    const api = createModuleApi()
    startMainCompileCache(null, api)()
    expect(api.enableCompileCache).not.toHaveBeenCalled()
    expect(api.flushCompileCache).not.toHaveBeenCalled()
  })

  it('flushes after startup and again for late-loaded modules', () => {
    vi.useFakeTimers()
    const api = createModuleApi()
    const flush = startMainCompileCache('cache-dir', api)
    expect(api.enableCompileCache).toHaveBeenCalledWith('cache-dir')
    flush()
    expect(api.flushCompileCache).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(60_000)
    expect(api.flushCompileCache).toHaveBeenCalledTimes(2)
  })

  it('never flushes when enabling failed or threw', () => {
    const failed = createModuleApi(STATUS.FAILED)
    startMainCompileCache('cache-dir', failed)()
    expect(failed.flushCompileCache).not.toHaveBeenCalled()

    const throwing = createModuleApi()
    throwing.enableCompileCache.mockImplementation(() => {
      throw new Error('EACCES')
    })
    expect(() => startMainCompileCache('cache-dir', throwing)()).not.toThrow()
    expect(throwing.flushCompileCache).not.toHaveBeenCalled()
  })

  it('swallows flush failures', () => {
    vi.useFakeTimers()
    const api = createModuleApi()
    api.flushCompileCache.mockImplementation(() => {
      throw new Error('ENOSPC')
    })
    expect(() => startMainCompileCache('cache-dir', api)()).not.toThrow()
  })
})

describe('pruneStaleMainCompileCacheVersions', () => {
  let root: string | undefined

  afterEach(() => {
    if (root) {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('removes other runtime versions and keeps the active one', async () => {
    root = mkdtempSync(join(tmpdir(), 'main-compile-cache-'))
    const cacheRoot = join(root, MAIN_COMPILE_CACHE_DIR_NAME)
    const active = join(cacheRoot, 'v24.21.0-x64-aaaa')
    const stale = join(cacheRoot, 'v24.14.0-x64-bbbb')
    mkdirSync(active, { recursive: true })
    mkdirSync(stale, { recursive: true })

    await pruneStaleMainCompileCacheVersions(active)

    expect(existsSync(active)).toBe(true)
    expect(existsSync(stale)).toBe(false)
  })

  it('refuses to prune outside a compile-cache root', async () => {
    root = mkdtempSync(join(tmpdir(), 'main-compile-cache-'))
    const active = join(root, 'v24')
    const sibling = join(root, 'unrelated')
    mkdirSync(active, { recursive: true })
    mkdirSync(sibling, { recursive: true })

    await pruneStaleMainCompileCacheVersions(active)

    expect(existsSync(sibling)).toBe(true)
  })
})
