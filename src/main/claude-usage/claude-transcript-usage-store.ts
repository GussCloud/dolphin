import type {
  ClaudeUsageBreakdownKind,
  ClaudeUsageBreakdownRow,
  ClaudeUsageDailyPoint,
  ClaudeUsageRange,
  ClaudeUsageScope,
  ClaudeUsageSessionRow,
  ClaudeUsageSnapshot,
  ClaudeUsageSummary
} from '../../shared/claude-usage-types'
import type { Store } from '../persistence'
import type { UsageScanWorktreeRef } from '../usage/usage-provider-contract'
import { UsageProviderStoreLifecycle } from '../usage/usage-provider-store-lifecycle'
import type { ClaudeUsagePersistedFile, ClaudeUsagePersistedState } from './types'
import {
  buildBreakdown,
  buildDaily,
  buildSummary,
  type ClaudeUsageCostEstimator
} from './claude-usage-report-aggregation'
import { buildRecentSessions } from './claude-usage-session-rows'

// Why: v5 widens Claude ownership keys (message-id / uuid fallbacks). Older
// caches either lack ownership or used narrower keys and can under/over-count
// after fork reclaim (#8006). v6 adds the 1-hour cache-write split, which older
// caches never recorded, so their cost estimates stay stuck at the 5m rate (#15993).
// v7 stores ownership keys as compact digests. v6 caches keep their totals: the scan
// worker migrates their raw keys in place. Older builds reset on v7 instead of
// mismatching digests against the raw keys they compute.
const SCHEMA_VERSION = 7
const RAW_OWNERSHIP_KEY_SCHEMA_VERSION = 6

function getDefaultState(): ClaudeUsagePersistedState {
  return {
    schemaVersion: SCHEMA_VERSION,
    worktreeFingerprint: null,
    processedFiles: [],
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

function normalizePersistedState(state: ClaudeUsagePersistedState): ClaudeUsagePersistedState {
  if (state.schemaVersion === SCHEMA_VERSION) {
    return state
  }
  if (state.schemaVersion === RAW_OWNERSHIP_KEY_SCHEMA_VERSION) {
    return { ...state, schemaVersion: SCHEMA_VERSION }
  }
  // Scanner changes invalidate totals, but preserving enabled keeps existing tracking on.
  const defaults = getDefaultState()
  return {
    ...defaults,
    scanState: {
      ...defaults.scanState,
      enabled: state.scanState.enabled ?? defaults.scanState.enabled
    }
  }
}

export type ClaudeTranscriptUsageStoreConfig = {
  logTag: string
  resolveCacheFile: () => string
  scan: ClaudeTranscriptUsageScan
  /** Omitted: Claude's own pricing table. */
  estimateCost?: ClaudeUsageCostEstimator
}

export type ClaudeTranscriptUsageScan = (
  worktrees: UsageScanWorktreeRef[],
  previous: ClaudeUsagePersistedFile[]
) => Promise<
  Pick<ClaudeUsagePersistedState, 'processedFiles' | 'sessions' | 'dailyAggregates'> & {
    unchanged?: boolean
  }
>

/** Report store over one Claude-format transcript corpus (Claude's own, or DeepSeek's). */
export class ClaudeTranscriptUsageStore extends UsageProviderStoreLifecycle<
  'processedFiles',
  ClaudeUsagePersistedState,
  'hasAnyClaudeData'
> {
  private readonly estimateCost: ClaudeUsageCostEstimator | undefined

  constructor(
    store: Pick<Store, 'getRepos' | 'getAllWorktreeMeta'>,
    config: ClaudeTranscriptUsageStoreConfig
  ) {
    super(store, {
      logTag: config.logTag,
      resolveCacheFile: config.resolveCacheFile,
      createDefaultState: getDefaultState,
      normalizeState: normalizePersistedState,
      sourceKey: 'processedFiles',
      dataPresenceKey: 'hasAnyClaudeData',
      // Why no indent: the cache holds the whole transcript history and is machine-read only.
      scan: config.scan
    })
    this.estimateCost = config.estimateCost
  }

  getSnapshot(
    scope: ClaudeUsageScope,
    range: ClaudeUsageRange,
    recentSessionLimit = 10
  ): ClaudeUsageSnapshot {
    return {
      scanState: this.getScanState(),
      summary: buildSummary(this.state, scope, range, this.estimateCost),
      daily: buildDaily(this.state, scope, range),
      modelBreakdown: buildBreakdown(this.state, scope, range, 'model', this.estimateCost),
      projectBreakdown: buildBreakdown(this.state, scope, range, 'project', this.estimateCost),
      recentSessions: buildRecentSessions(this.state, scope, range, recentSessionLimit)
    }
  }

  async getSummary(scope: ClaudeUsageScope, range: ClaudeUsageRange): Promise<ClaudeUsageSummary> {
    await this.refresh(false)
    return buildSummary(this.state, scope, range, this.estimateCost)
  }

  async getDaily(
    scope: ClaudeUsageScope,
    range: ClaudeUsageRange
  ): Promise<ClaudeUsageDailyPoint[]> {
    await this.refresh(false)
    return buildDaily(this.state, scope, range)
  }

  async getBreakdown(
    scope: ClaudeUsageScope,
    range: ClaudeUsageRange,
    kind: ClaudeUsageBreakdownKind
  ): Promise<ClaudeUsageBreakdownRow[]> {
    await this.refresh(false)
    return buildBreakdown(this.state, scope, range, kind, this.estimateCost)
  }

  async getRecentSessions(
    scope: ClaudeUsageScope,
    range: ClaudeUsageRange,
    limit = 12
  ): Promise<ClaudeUsageSessionRow[]> {
    await this.refresh(false)
    return buildRecentSessions(this.state, scope, range, limit)
  }
}
