import { useAppStore } from '../../store'
import { ClaudeTranscriptUsagePane } from './ClaudeTranscriptUsagePane'
import { translate } from '@/i18n/i18n'

export function ClaudeUsagePane(): React.JSX.Element {
  const scanState = useAppStore((state) => state.claudeUsageScanState)
  const summary = useAppStore((state) => state.claudeUsageSummary)
  const daily = useAppStore((state) => state.claudeUsageDaily)
  const modelBreakdown = useAppStore((state) => state.claudeUsageModelBreakdown)
  const projectBreakdown = useAppStore((state) => state.claudeUsageProjectBreakdown)
  const recentSessions = useAppStore((state) => state.claudeUsageRecentSessions)
  const scope = useAppStore((state) => state.claudeUsageScope)
  const range = useAppStore((state) => state.claudeUsageRange)
  const fetch = useAppStore((state) => state.fetchClaudeUsage)
  const setEnabled = useAppStore((state) => state.setClaudeUsageEnabled)
  const refresh = useAppStore((state) => state.refreshClaudeUsage)
  const setScope = useAppStore((state) => state.setClaudeUsageScope)
  const setRange = useAppStore((state) => state.setClaudeUsageRange)

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
          'auto.components.stats.ClaudeUsagePane.6afacbee37',
          'Claude Usage Tracking'
        ),
        enable: translate(
          'auto.components.stats.ClaudeUsagePane.424cd50412',
          'Enable Claude usage analytics'
        ),
        disabledDescription: translate(
          'auto.components.stats.ClaudeUsagePane.0cb1a36d7d',
          'Reads local Claude usage logs to show token, model, and session stats.'
        ),
        allScope: translate(
          'auto.components.stats.ClaudeUsagePane.5ce4842c2c',
          'All local Claude usage'
        ),
        options: translate(
          'auto.components.stats.ClaudeUsagePane.e9bf9fce0e',
          'Claude usage options'
        ),
        refreshAria: translate(
          'auto.components.stats.ClaudeUsagePane.c5b9b344d0',
          'Refresh Claude usage'
        ),
        empty: translate(
          'auto.components.stats.ClaudeUsagePane.7dde9331fd',
          'No local Claude usage found yet for this scope.'
        )
      }}
      showCost
      shareProvider="claude"
    />
  )
}
