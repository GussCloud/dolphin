import { useEffect } from 'react'
import {
  Activity,
  Coins,
  DatabaseZap,
  FolderKanban,
  Gauge,
  Sparkles,
  Waypoints
} from 'lucide-react'
import type {
  ClaudeUsageBreakdownRow,
  ClaudeUsageDailyPoint,
  ClaudeUsageRange,
  ClaudeUsageScanState,
  ClaudeUsageScope,
  ClaudeUsageSessionRow,
  ClaudeUsageSummary
} from '../../../../shared/claude-usage-types'
import { useAppStore } from '../../store'
import { ClaudeUsageDetails } from './ClaudeUsageDetails'
import { ClaudeUsageLoadingState } from './ClaudeUsageLoadingState'
import { ShareUsageButton } from './ShareUsageButton'
import { StatCard } from './StatCard'
import { UsageFilterRadioGroup, UsageTrackingPaneShell } from './UsageTrackingPaneShell'
import { formatCost, formatTokens, formatUpdatedAt } from './usage-formatters'
import { translate } from '@/i18n/i18n'

const RANGE_OPTIONS: ClaudeUsageRange[] = ['7d', '30d', '90d', 'all']
const RANGE_LABELS: Record<ClaudeUsageRange, string> = {
  get '7d'() {
    return translate('auto.components.stats.ClaudeUsagePane.rangeLast7Days', 'Last 7 days')
  },
  get '30d'() {
    return translate('auto.components.stats.ClaudeUsagePane.rangeLast30Days', 'Last 30 days')
  },
  get '90d'() {
    return translate('auto.components.stats.ClaudeUsagePane.rangeLast90Days', 'Last 90 days')
  },
  get all() {
    return translate('auto.components.stats.ClaudeUsagePane.rangeAllTime', 'All time')
  }
}

export type ClaudeTranscriptUsageData = {
  scanState: ClaudeUsageScanState | null
  summary: ClaudeUsageSummary | null
  daily: ClaudeUsageDailyPoint[]
  modelBreakdown: ClaudeUsageBreakdownRow[]
  projectBreakdown: ClaudeUsageBreakdownRow[]
  recentSessions: ClaudeUsageSessionRow[]
  scope: ClaudeUsageScope
  range: ClaudeUsageRange
}

export type ClaudeTranscriptUsageActions = {
  fetch: () => Promise<void>
  setEnabled: (enabled: boolean) => Promise<void>
  refresh: () => Promise<void>
  setScope: (scope: ClaudeUsageScope) => Promise<void>
  setRange: (range: ClaudeUsageRange) => Promise<void>
}

/** Provider-specific copy; everything else is shared with Claude's pane. */
export type ClaudeTranscriptUsageLabels = {
  title: string
  enable: string
  disabledDescription: string
  allScope: string
  options: string
  refreshAria: string
  empty: string
}

type ClaudeTranscriptUsagePaneProps = {
  data: ClaudeTranscriptUsageData
  actions: ClaudeTranscriptUsageActions
  labels: ClaudeTranscriptUsageLabels
  /** False when the provider has no pricing table: the cost card would only ever read n/a. */
  showCost: boolean
  /** Only Claude has a share card. */
  shareProvider?: 'claude'
}

/** Report pane for a Claude-format transcript corpus (Claude's own, or DeepSeek's). */
export function ClaudeTranscriptUsagePane({
  data,
  actions,
  labels,
  showCost,
  shareProvider
}: ClaudeTranscriptUsagePaneProps): React.JSX.Element {
  const { scanState, summary, daily, scope, range } = data
  const { fetch } = actions
  const recordFeatureInteraction = useAppStore((state) => state.recordFeatureInteraction)
  const scopeOptions: { value: ClaudeUsageScope; label: string }[] = [
    {
      value: 'dolphin',
      label: translate('auto.components.stats.ClaudeUsagePane.4f8368c272', 'Dolphin worktrees only')
    },
    { value: 'all', label: labels.allScope }
  ]

  useEffect(() => {
    void fetch()
  }, [fetch])

  const handleSetEnabled = (enabled: boolean): void => {
    recordFeatureInteraction('usage-tracking')
    void actions.setEnabled(enabled)
  }

  if (!scanState?.enabled) {
    return (
      <UsageTrackingPaneShell
        enabled={false}
        title={labels.title}
        disabledDescription={labels.disabledDescription}
        enableLabel={labels.enable}
        onEnabledChange={handleSetEnabled}
      />
    )
  }

  if (!summary && (scanState.isScanning || scanState.lastScanCompletedAt === null)) {
    return <ClaudeUsageLoadingState title={labels.title} summaryCardCount={showCost ? 8 : 7} />
  }

  const hasAnyData = summary?.hasAnyClaudeData ?? scanState.hasAnyClaudeData

  return (
    <UsageTrackingPaneShell
      enabled
      title={labels.title}
      status={
        <>
          {formatUpdatedAt(scanState.lastScanCompletedAt)}
          {scanState.lastScanError
            ? translate(
                'auto.components.stats.ClaudeUsagePane.2d41fd45c6',
                ' • Last scan error: {{value0}}',
                { value0: scanState.lastScanError }
              )
            : ''}
        </>
      }
      isRefreshing={scanState.isScanning}
      hasData={hasAnyData}
      enableLabel={labels.enable}
      optionsLabel={labels.options}
      filtersLabel={translate('auto.components.stats.ClaudeUsagePane.dd29209b21', 'Filters')}
      refreshAriaLabel={labels.refreshAria}
      refreshLabel={translate('auto.components.stats.ClaudeUsagePane.8d18bbb771', 'Refresh')}
      filterSections={[
        <UsageFilterRadioGroup
          key="scope"
          label={translate('auto.components.stats.ClaudeUsagePane.f61cffb9c8', 'Scope')}
          value={scope}
          options={scopeOptions}
          onValueChange={(value) => void actions.setScope(value)}
        />,
        <UsageFilterRadioGroup
          key="range"
          label={translate('auto.components.stats.ClaudeUsagePane.505be9aac4', 'Range')}
          value={range}
          options={RANGE_OPTIONS.map((value) => ({ value, label: RANGE_LABELS[value] }))}
          onValueChange={(value) => void actions.setRange(value)}
        />
      ]}
      selectionSummary={
        <>
          {scopeOptions.find((option) => option.value === scope)?.label} • {RANGE_LABELS[range]}
        </>
      }
      emptyMessage={labels.empty}
      onEnabledChange={handleSetEnabled}
      onRefresh={() => void actions.refresh()}
      headerAction={
        shareProvider && summary && daily.length > 0 ? (
          <ShareUsageButton
            provider={shareProvider}
            summary={summary}
            daily={daily}
            range={range}
          />
        ) : undefined
      }
    >
      <>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={translate('auto.components.stats.ClaudeUsagePane.ea71fae8fc', 'Input tokens')}
            value={formatTokens(summary?.inputTokens ?? 0)}
            icon={<Sparkles className="size-4" />}
          />
          <StatCard
            label={translate('auto.components.stats.ClaudeUsagePane.2b8a2f14aa', 'Output tokens')}
            value={formatTokens(summary?.outputTokens ?? 0)}
            icon={<Activity className="size-4" />}
          />
          <StatCard
            label={translate('auto.components.stats.ClaudeUsagePane.268cf0af51', 'Cache read')}
            value={formatTokens(summary?.cacheReadTokens ?? 0)}
            icon={<DatabaseZap className="size-4" />}
          />
          <StatCard
            label={translate('auto.components.stats.ClaudeUsagePane.b786fb4a70', 'Cache write')}
            value={formatTokens(summary?.cacheWriteTokens ?? 0)}
            icon={<Waypoints className="size-4" />}
          />
          <StatCard
            label={translate(
              'auto.components.stats.ClaudeUsagePane.1634c4f404',
              'Cache reuse rate'
            )}
            value={
              summary?.cacheReuseRate !== null && summary?.cacheReuseRate !== undefined
                ? `${Math.round(summary.cacheReuseRate * 100)}%`
                : 'n/a'
            }
            icon={<Gauge className="size-4" />}
          />
          <StatCard
            label={translate(
              'auto.components.stats.ClaudeUsagePane.8cc23be4a3',
              'Zero-cache-read turns'
            )}
            value={
              summary && summary.turns > 0
                ? `${Math.round((summary.zeroCacheReadTurns / summary.turns) * 100)}%`
                : 'n/a'
            }
            icon={<DatabaseZap className="size-4" />}
          />
          <StatCard
            label={translate(
              'auto.components.stats.ClaudeUsagePane.0f3e696ca9',
              'Sessions / Turns'
            )}
            value={`${(summary?.sessions ?? 0).toLocaleString()} / ${(summary?.turns ?? 0).toLocaleString()}`}
            icon={<FolderKanban className="size-4" />}
          />
          {showCost ? (
            <StatCard
              label={translate(
                'auto.components.stats.ClaudeUsagePane.b26d4ddb58',
                'Est. API-equivalent cost'
              )}
              value={formatCost(summary?.estimatedCostUsd ?? null)}
              icon={<Coins className="size-4" />}
            />
          ) : null}
        </div>
        <p className="px-1 text-xs text-muted-foreground">
          {translate(
            'auto.components.stats.ClaudeUsagePane.51ae85fa00',
            'Cache reuse rate is calculated as cache read tokens / (input tokens + cache read tokens).'
          )}
        </p>

        <ClaudeUsageDetails
          daily={daily}
          modelBreakdown={data.modelBreakdown}
          projectBreakdown={data.projectBreakdown}
          recentSessions={data.recentSessions}
          summary={summary}
        />
      </>
    </UsageTrackingPaneShell>
  )
}
