import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UsageProviderStoreLifecycle } from './usage-provider-store-lifecycle'

type LazyTestState = {
  worktreeFingerprint: string | null
  processedSources: { id: string }[]
  sessions: { id: string }[]
  dailyAggregates: { day: string }[]
  scanState: {
    enabled: boolean
    lastScanStartedAt: number | null
    lastScanCompletedAt: number | null
    lastScanError: string | null
  }
}

function defaultState(): LazyTestState {
  return {
    worktreeFingerprint: null,
    processedSources: [],
    sessions: [],
    dailyAggregates: [],
    scanState: {
      enabled: false,
      lastScanStartedAt: null,
      lastScanCompletedAt: null,
      lastScanError: null
    }
  }
}

function persistedState(): LazyTestState {
  const state = defaultState()
  return {
    ...state,
    worktreeFingerprint: '[]',
    processedSources: [{ id: 'source' }],
    sessions: [{ id: 'session' }],
    scanState: { ...state.scanState, enabled: true, lastScanCompletedAt: 1 }
  }
}

class LazyTestStore extends UsageProviderStoreLifecycle<
  'processedSources',
  LazyTestState,
  'hasAnyTestData'
> {
  constructor(cacheFile: string) {
    super(
      { getRepos: () => [], getAllWorktreeMeta: () => ({}) },
      {
        logTag: '[lazy-usage]',
        resolveCacheFile: () => cacheFile,
        createDefaultState: defaultState,
        normalizeState: (state) => state,
        sourceKey: 'processedSources',
        dataPresenceKey: 'hasAnyTestData',
        scan: async () => ({ processedSources: [], sessions: [], dailyAggregates: [] })
      }
    )
  }
}

describe('UsageProviderStoreLifecycle lazy cache load', () => {
  let directory: string
  let cacheFile: string

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'dolphin-usage-lazy-load-'))
    cacheFile = join(directory, 'usage.json')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    rmSync(directory, { recursive: true, force: true })
  })

  it('reads nothing at construction and loads on first use', async () => {
    const store = new LazyTestStore(cacheFile)
    writeFileSync(cacheFile, JSON.stringify(persistedState()))

    expect(await store.getScanState()).toMatchObject({ enabled: true, hasAnyTestData: true })
  })

  it('keeps the cached history when tracking is toggled before any read', async () => {
    writeFileSync(cacheFile, JSON.stringify(persistedState()))
    const store = new LazyTestStore(cacheFile)

    await store.setEnabled(false)
    await store.flush()

    const written: LazyTestState = JSON.parse(readFileSync(cacheFile, 'utf-8'))
    expect(written.scanState.enabled).toBe(false)
    expect(written.processedSources).toEqual([{ id: 'source' }])
    expect(written.sessions).toEqual([{ id: 'session' }])
  })

  it('starts from defaults on a corrupt cache without failing the getter', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    writeFileSync(cacheFile, '{"scanState":')
    const store = new LazyTestStore(cacheFile)

    expect(await store.getScanState()).toMatchObject({ enabled: false, hasAnyTestData: false })
    expect(consoleError).toHaveBeenCalledTimes(1)
  })

  it('treats a missing cache as disabled tracking without logging', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const store = new LazyTestStore(cacheFile)

    expect(await store.refresh()).toMatchObject({ enabled: false, isScanning: false })
    expect(consoleError).not.toHaveBeenCalled()
  })
})
