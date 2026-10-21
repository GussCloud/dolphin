import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  adoptInheritedCompileCache,
  withInheritedCompileCache,
  type ChildCompileCacheModuleApi
} from './child-compile-cache'
import { MAIN_COMPILE_CACHE_DIR_NAME } from './main-compile-cache'

const CACHE_ROOT = join('profile', 'dolphin', MAIN_COMPILE_CACHE_DIR_NAME)
const ACTIVE_VERSION_DIR = join(CACHE_ROOT, 'v24.21.0-x64-2d60bbc0-0')

function createModuleApi(activeDir: string | null = ACTIVE_VERSION_DIR) {
  return {
    getCompileCacheDir: vi.fn(() => activeDir ?? undefined),
    flushCompileCache: vi.fn<() => void>()
  }
}

describe('withInheritedCompileCache', () => {
  it("points the child at this process's cache root so Node keys its own runtime subdirectory", () => {
    const env = withInheritedCompileCache({ PATH: 'bin' }, createModuleApi())
    expect(env).toEqual({ PATH: 'bin', NODE_COMPILE_CACHE: CACHE_ROOT })
  })

  it('adds nothing when the cache is off (dev, E2E, AppImage, enable failure) or unsupported', () => {
    expect(withInheritedCompileCache({ PATH: 'bin' }, createModuleApi(null))).toEqual({
      PATH: 'bin'
    })
    expect(withInheritedCompileCache({ PATH: 'bin' }, {})).toEqual({ PATH: 'bin' })
  })

  it("never forwards a cache directory that is not Dolphin's own", () => {
    const foreign = createModuleApi(join('user', 'my-cache', 'v24.21.0-x64-2d60bbc0-0'))
    expect(withInheritedCompileCache({}, foreign)).toEqual({})
  })

  it('keeps a NODE_COMPILE_CACHE the caller already set', () => {
    expect(withInheritedCompileCache({ NODE_COMPILE_CACHE: 'mine' }, createModuleApi())).toEqual({
      NODE_COMPILE_CACHE: 'mine'
    })
  })

  it('treats a throwing runtime query as cache off', () => {
    const api: ChildCompileCacheModuleApi = {
      getCompileCacheDir: () => {
        throw new Error('unsupported')
      }
    }
    expect(withInheritedCompileCache({}, api)).toEqual({})
  })
})

describe('adoptInheritedCompileCache', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('strips the inherited variable so grandchildren such as PTY shells do not write into it', () => {
    const env: NodeJS.ProcessEnv = { NODE_COMPILE_CACHE: CACHE_ROOT, PATH: 'bin' }
    adoptInheritedCompileCache(createModuleApi(), env)
    expect(env).toEqual({ PATH: 'bin' })
  })

  it("leaves a user's own NODE_COMPILE_CACHE in place", () => {
    const env: NodeJS.ProcessEnv = { NODE_COMPILE_CACHE: join('user', 'my-cache') }
    adoptInheritedCompileCache(createModuleApi(null), env)
    expect(env.NODE_COMPILE_CACHE).toBe(join('user', 'my-cache'))
  })

  it('flushes once the entry has loaded and again for late-loaded modules', () => {
    vi.useFakeTimers()
    const api = createModuleApi()
    adoptInheritedCompileCache(api, {})
    expect(api.flushCompileCache).not.toHaveBeenCalled()
    vi.advanceTimersByTime(0)
    expect(api.flushCompileCache).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(60_000)
    expect(api.flushCompileCache).toHaveBeenCalledTimes(2)
  })

  it('schedules nothing when the child runs without the cache or on a runtime without it', () => {
    vi.useFakeTimers()
    const off = createModuleApi(null)
    adoptInheritedCompileCache(off, {})
    expect(() => adoptInheritedCompileCache({}, {})).not.toThrow()
    vi.advanceTimersByTime(60_000)
    expect(off.flushCompileCache).not.toHaveBeenCalled()
  })

  it('never fails the child when the cache directory is unwritable', () => {
    vi.useFakeTimers()
    const api = createModuleApi()
    api.flushCompileCache.mockImplementation(() => {
      throw new Error('EACCES')
    })
    adoptInheritedCompileCache(api, {})
    expect(() => vi.advanceTimersByTime(60_000)).not.toThrow()
    expect(api.flushCompileCache).toHaveBeenCalledTimes(2)
  })
})
