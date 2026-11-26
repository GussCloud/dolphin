import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClaudeUsageDailyAggregate } from '../claude-usage/types'
import { estimateCostUsd } from '../claude-usage/claude-model-pricing'

const { getPathMock } = vi.hoisted(() => ({
  getPathMock: vi.fn(() => '/tmp/dolphin-test-userdata')
}))

vi.mock('electron', () => ({ app: { getPath: getPathMock } }))

vi.mock('../usage/usage-scan-worker-spawn', () => ({
  scanClaudeUsageFilesViaWorker: vi.fn(),
  scanClaudeApiUsageFilesViaWorker: vi.fn()
}))

import { ClaudeApiUsageStore, initClaudeApiUsagePath } from './store'
import { initClaudeUsagePath } from '../claude-usage/store'
import {
  scanClaudeApiUsageFilesViaWorker,
  scanClaudeUsageFilesViaWorker
} from '../usage/usage-scan-worker-spawn'

const backingStore = { getRepos: () => [], getAllWorktreeMeta: () => ({}) }

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

describe('ClaudeApiUsageStore', () => {
  let userData: string

  beforeEach(() => {
    userData = mkdtempSync(join(tmpdir(), 'dolphin-claude-api-usage-store-'))
    getPathMock.mockReturnValue(userData)
    initClaudeUsagePath()
    initClaudeApiUsagePath()
    vi.mocked(scanClaudeUsageFilesViaWorker).mockReset()
    vi.mocked(scanClaudeApiUsageFilesViaWorker)
      .mockReset()
      .mockResolvedValue({ processedFiles: [], sessions: [], dailyAggregates: [daily] })
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-21T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    rmSync(userData, { recursive: true, force: true })
  })

  it('scans the API profiles into its own cache and prices turns at Claude list prices', async () => {
    const store = new ClaudeApiUsageStore(backingStore)
    await store.setEnabled(true)
    await store.refresh(true)
    await store.flush()

    expect(scanClaudeApiUsageFilesViaWorker).toHaveBeenCalledTimes(1)
    expect(scanClaudeUsageFilesViaWorker).not.toHaveBeenCalled()
    expect(existsSync(join(userData, 'dolphin-claude-api-usage.json'))).toBe(true)
    expect(existsSync(join(userData, 'dolphin-claude-usage.json'))).toBe(false)

    const expectedCost = estimateCostUsd('claude-sonnet-4-6', 1_000, 500, 200, 100, 0)
    expect(expectedCost).toBeGreaterThan(0)
    const snapshot = await store.getSnapshot('all', 'all')
    expect(snapshot.summary).toMatchObject({
      inputTokens: 1_000,
      outputTokens: 500,
      turns: 2,
      hasAnyClaudeData: true
    })
    expect(snapshot.summary.estimatedCostUsd).toBeCloseTo(expectedCost ?? 0, 10)
    expect(snapshot.modelBreakdown[0]?.estimatedCostUsd).toBeCloseTo(expectedCost ?? 0, 10)
  })
})
