import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClaudeUsageDailyAggregate } from '../claude-usage/types'

const { getPathMock } = vi.hoisted(() => ({
  getPathMock: vi.fn(() => '/tmp/dolphin-test-userdata')
}))

vi.mock('electron', () => ({ app: { getPath: getPathMock } }))

vi.mock('../usage/usage-scan-worker-spawn', () => ({
  scanClaudeUsageFilesViaWorker: vi.fn(),
  scanDeepSeekUsageFilesViaWorker: vi.fn()
}))

import { DeepSeekUsageStore, initDeepSeekUsagePath } from './store'
import { ClaudeUsageStore, initClaudeUsagePath } from '../claude-usage/store'
import {
  scanClaudeUsageFilesViaWorker,
  scanDeepSeekUsageFilesViaWorker
} from '../usage/usage-scan-worker-spawn'

const backingStore = { getRepos: () => [], getAllWorktreeMeta: () => ({}) }

// Worst case: a Claude-looking model id must still not be priced at Claude rates.
const daily: ClaudeUsageDailyAggregate = {
  day: '2026-10-20',
  model: 'claude-sonnet-4-6',
  projectKey: 'unscoped:repo-a',
  projectLabel: 'repo-a',
  repoId: null,
  worktreeId: null,
  turnCount: 2,
  zeroCacheReadTurnCount: 0,
  inputTokens: 1_000,
  outputTokens: 500,
  cacheReadTokens: 200,
  cacheWriteTokens: 100,
  cacheWrite1hTokens: 0
}

const projection = { processedFiles: [], sessions: [], dailyAggregates: [daily] }

describe('DeepSeekUsageStore', () => {
  let userData: string

  beforeEach(() => {
    userData = mkdtempSync(join(tmpdir(), 'dolphin-deepseek-usage-store-'))
    getPathMock.mockReturnValue(userData)
    initClaudeUsagePath()
    initDeepSeekUsagePath()
    vi.mocked(scanClaudeUsageFilesViaWorker).mockReset().mockResolvedValue(projection)
    vi.mocked(scanDeepSeekUsageFilesViaWorker).mockReset().mockResolvedValue(projection)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-21T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    rmSync(userData, { recursive: true, force: true })
  })

  it('scans the DeepSeek corpus into its own cache and never prices it', async () => {
    const store = new DeepSeekUsageStore(backingStore)
    await store.setEnabled(true)
    await store.refresh(true)
    await store.flush()

    expect(scanDeepSeekUsageFilesViaWorker).toHaveBeenCalledTimes(1)
    expect(scanClaudeUsageFilesViaWorker).not.toHaveBeenCalled()
    expect(existsSync(join(userData, 'dolphin-deepseek-usage.json'))).toBe(true)
    expect(existsSync(join(userData, 'dolphin-claude-usage.json'))).toBe(false)

    const snapshot = await store.getSnapshot('all', 'all')
    expect(snapshot.summary).toMatchObject({
      inputTokens: 1_000,
      outputTokens: 500,
      turns: 2,
      estimatedCostUsd: null,
      hasAnyClaudeData: true
    })
    expect(snapshot.modelBreakdown.map((row) => row.estimatedCostUsd)).toEqual([null])
  })

  it('leaves Claude pricing unchanged for the same rows', async () => {
    const store = new ClaudeUsageStore(backingStore)
    await store.setEnabled(true)
    await store.refresh(true)

    expect(scanDeepSeekUsageFilesViaWorker).not.toHaveBeenCalled()
    expect((await store.getSnapshot('all', 'all')).summary.estimatedCostUsd).toBeGreaterThan(0)
  })
})
