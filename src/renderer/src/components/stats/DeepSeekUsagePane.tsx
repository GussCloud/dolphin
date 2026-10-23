import { useAppStore } from '../../store'
import { ClaudeTranscriptUsagePane } from './ClaudeTranscriptUsagePane'
import { translate } from '@/i18n/i18n'

/** DeepSeek runs Claude Code, so its report is Claude's pane over `~/.claude-deepseek`, unpriced. */
export function DeepSeekUsagePane(): React.JSX.Element {
  const scanState = useAppStore((state) => state.deepSeekUsageScanState)
  const summary = useAppStore((state) => state.deepSeekUsageSummary)
  const daily = useAppStore((state) => state.deepSeekUsageDaily)
  const modelBreakdown = useAppStore((state) => state.deepSeekUsageModelBreakdown)
  const projectBreakdown = useAppStore((state) => state.deepSeekUsageProjectBreakdown)
  const recentSessions = useAppStore((state) => state.deepSeekUsageRecentSessions)
  const scope = useAppStore((state) => state.deepSeekUsageScope)
  const range = useAppStore((state) => state.deepSeekUsageRange)
  const fetch = useAppStore((state) => state.fetchDeepSeekUsage)
  const setEnabled = useAppStore((state) => state.setDeepSeekUsageEnabled)
  const refresh = useAppStore((state) => state.refreshDeepSeekUsage)
  const setScope = useAppStore((state) => state.setDeepSeekUsageScope)
  const setRange = useAppStore((state) => state.setDeepSeekUsageRange)

  return (
    <ClaudeTranscriptUsagePane
      data={{
        scanState,
        summary,
        daily,
        modelBreakdown,
        projectBreakdown,
        recentSessions,
        scope,
        range
      }}
      actions={{ fetch, setEnabled, refresh, setScope, setRange }}
      labels={{
        title: translate(
          'auto.components.stats.DeepSeekUsagePane.title',
          'DeepSeek Usage Tracking'
        ),
        enable: translate(
          'auto.components.stats.DeepSeekUsagePane.enable',
          'Enable DeepSeek usage analytics'
        ),
        disabledDescription: translate(
          'auto.components.stats.DeepSeekUsagePane.disabledDescription',
          'Reads local DeepSeek usage logs to show token, model, and session stats. Cost is not estimated.'
        ),
        allScope: translate(
          'auto.components.stats.DeepSeekUsagePane.allScope',
          'All local DeepSeek usage'
        ),
        options: translate(
          'auto.components.stats.DeepSeekUsagePane.options',
          'DeepSeek usage options'
        ),
        refreshAria: translate(
          'auto.components.stats.DeepSeekUsagePane.refresh',
          'Refresh DeepSeek usage'
        ),
        empty: translate(
          'auto.components.stats.DeepSeekUsagePane.empty',
          'No local DeepSeek usage found yet for this scope.'
        )
      }}
      showCost={false}
    />
  )
}
