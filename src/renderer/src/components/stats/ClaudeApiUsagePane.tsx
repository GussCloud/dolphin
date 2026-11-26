import { useAppStore } from '../../store'
import { ClaudeTranscriptUsagePane } from './ClaudeTranscriptUsagePane'
import { translate } from '@/i18n/i18n'

/** API-key accounts run Claude Code, so their report is Claude's pane over their profiles only. */
export function ClaudeApiUsagePane(): React.JSX.Element {
  const scanState = useAppStore((state) => state.claudeApiUsageScanState)
  const summary = useAppStore((state) => state.claudeApiUsageSummary)
  const daily = useAppStore((state) => state.claudeApiUsageDaily)
  const modelBreakdown = useAppStore((state) => state.claudeApiUsageModelBreakdown)
  const projectBreakdown = useAppStore((state) => state.claudeApiUsageProjectBreakdown)
  const recentSessions = useAppStore((state) => state.claudeApiUsageRecentSessions)
  const scope = useAppStore((state) => state.claudeApiUsageScope)
  const range = useAppStore((state) => state.claudeApiUsageRange)
  const fetch = useAppStore((state) => state.fetchClaudeApiUsage)
  const setEnabled = useAppStore((state) => state.setClaudeApiUsageEnabled)
  const refresh = useAppStore((state) => state.refreshClaudeApiUsage)
  const setScope = useAppStore((state) => state.setClaudeApiUsageScope)
  const setRange = useAppStore((state) => state.setClaudeApiUsageRange)

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
          'auto.components.stats.ClaudeApiUsagePane.title',
          'Claude (API) Usage Tracking'
        ),
        enable: translate(
          'auto.components.stats.ClaudeApiUsagePane.enable',
          'Enable Claude (API) usage analytics'
        ),
        disabledDescription: translate(
          'auto.components.stats.ClaudeApiUsagePane.disabledDescription',
          'Reads the local usage logs of your Claude API accounts to show token, model, session, and estimated cost stats.'
        ),
        allScope: translate(
          'auto.components.stats.ClaudeApiUsagePane.allScope',
          'All local Claude (API) usage'
        ),
        options: translate(
          'auto.components.stats.ClaudeApiUsagePane.options',
          'Claude (API) usage options'
        ),
        refreshAria: translate(
          'auto.components.stats.ClaudeApiUsagePane.refresh',
          'Refresh Claude (API) usage'
        ),
        empty: translate(
          'auto.components.stats.ClaudeApiUsagePane.empty',
          'No local Claude (API) usage found yet for this scope.'
        ),
        cost: translate('auto.components.stats.ClaudeApiUsagePane.cost', 'Est. cost (list prices)'),
        costNote: translate(
          'auto.components.stats.ClaudeApiUsagePane.costNote',
          'Cost is estimated from Anthropic list prices; your invoice can differ.'
        )
      }}
      showCost
    />
  )
}
