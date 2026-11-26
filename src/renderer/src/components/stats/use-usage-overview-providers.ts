import { useCallback, useEffect, useMemo } from 'react'
import { useAppStore } from '../../store'
import type { UsageOverviewInput, UsageProviderId } from './usage-overview-types'

type UsageOverviewProviders = {
  input: UsageOverviewInput
  refreshEnabled: () => Promise<unknown>
  enable: (id: UsageProviderId) => Promise<void>
}

/** Every token-analytics provider the Overview combines, read from its own store slice. */
export function useUsageOverviewProviders(): UsageOverviewProviders {
  const claudeScanState = useAppStore((state) => state.claudeUsageScanState)
  const claudeSummary = useAppStore((state) => state.claudeUsageSummary)
  const claudeDaily = useAppStore((state) => state.claudeUsageDaily)
  const claudeApiScanState = useAppStore((state) => state.claudeApiUsageScanState)
  const claudeApiSummary = useAppStore((state) => state.claudeApiUsageSummary)
  const claudeApiDaily = useAppStore((state) => state.claudeApiUsageDaily)
  const deepSeekScanState = useAppStore((state) => state.deepSeekUsageScanState)
  const deepSeekSummary = useAppStore((state) => state.deepSeekUsageSummary)
  const deepSeekDaily = useAppStore((state) => state.deepSeekUsageDaily)
  const codexScanState = useAppStore((state) => state.codexUsageScanState)
  const codexSummary = useAppStore((state) => state.codexUsageSummary)
  const codexDaily = useAppStore((state) => state.codexUsageDaily)
  const openCodeScanState = useAppStore((state) => state.openCodeUsageScanState)
  const openCodeSummary = useAppStore((state) => state.openCodeUsageSummary)
  const openCodeDaily = useAppStore((state) => state.openCodeUsageDaily)
  const museScanState = useAppStore((state) => state.museUsageScanState)
  const museSummary = useAppStore((state) => state.museUsageSummary)
  const museDaily = useAppStore((state) => state.museUsageDaily)
  const fetchClaudeUsage = useAppStore((state) => state.fetchClaudeUsage)
  const fetchClaudeApiUsage = useAppStore((state) => state.fetchClaudeApiUsage)
  const fetchDeepSeekUsage = useAppStore((state) => state.fetchDeepSeekUsage)
  const fetchCodexUsage = useAppStore((state) => state.fetchCodexUsage)
  const fetchOpenCodeUsage = useAppStore((state) => state.fetchOpenCodeUsage)
  const fetchMuseUsage = useAppStore((state) => state.fetchMuseUsage)
  const refreshClaudeUsage = useAppStore((state) => state.refreshClaudeUsage)
  const refreshClaudeApiUsage = useAppStore((state) => state.refreshClaudeApiUsage)
  const refreshDeepSeekUsage = useAppStore((state) => state.refreshDeepSeekUsage)
  const refreshCodexUsage = useAppStore((state) => state.refreshCodexUsage)
  const refreshOpenCodeUsage = useAppStore((state) => state.refreshOpenCodeUsage)
  const refreshMuseUsage = useAppStore((state) => state.refreshMuseUsage)
  const enableClaudeUsage = useAppStore((state) => state.enableClaudeUsage)
  const enableClaudeApiUsage = useAppStore((state) => state.enableClaudeApiUsage)
  const enableDeepSeekUsage = useAppStore((state) => state.enableDeepSeekUsage)
  const enableCodexUsage = useAppStore((state) => state.enableCodexUsage)
  const enableOpenCodeUsage = useAppStore((state) => state.enableOpenCodeUsage)
  const enableMuseUsage = useAppStore((state) => state.enableMuseUsage)

  useEffect(() => {
    void fetchClaudeUsage()
    void fetchClaudeApiUsage()
    void fetchDeepSeekUsage()
    void fetchCodexUsage()
    void fetchOpenCodeUsage()
    void fetchMuseUsage()
  }, [
    fetchClaudeUsage,
    fetchClaudeApiUsage,
    fetchDeepSeekUsage,
    fetchCodexUsage,
    fetchOpenCodeUsage,
    fetchMuseUsage
  ])

  const input = useMemo<UsageOverviewInput>(
    () => ({
      claude: { scanState: claudeScanState, summary: claudeSummary, daily: claudeDaily },
      'claude-api': {
        scanState: claudeApiScanState,
        summary: claudeApiSummary,
        daily: claudeApiDaily
      },
      deepseek: { scanState: deepSeekScanState, summary: deepSeekSummary, daily: deepSeekDaily },
      codex: { scanState: codexScanState, summary: codexSummary, daily: codexDaily },
      opencode: { scanState: openCodeScanState, summary: openCodeSummary, daily: openCodeDaily },
      muse: { scanState: museScanState, summary: museSummary, daily: museDaily }
    }),
    [
      claudeDaily,
      claudeScanState,
      claudeSummary,
      claudeApiDaily,
      claudeApiScanState,
      claudeApiSummary,
      deepSeekDaily,
      deepSeekScanState,
      deepSeekSummary,
      codexDaily,
      codexScanState,
      codexSummary,
      museDaily,
      museScanState,
      museSummary,
      openCodeDaily,
      openCodeScanState,
      openCodeSummary
    ]
  )

  const refreshEnabled = useCallback(
    () =>
      Promise.all([
        claudeScanState?.enabled ? refreshClaudeUsage() : Promise.resolve(),
        claudeApiScanState?.enabled ? refreshClaudeApiUsage() : Promise.resolve(),
        deepSeekScanState?.enabled ? refreshDeepSeekUsage() : Promise.resolve(),
        codexScanState?.enabled ? refreshCodexUsage() : Promise.resolve(),
        openCodeScanState?.enabled ? refreshOpenCodeUsage() : Promise.resolve(),
        museScanState?.enabled ? refreshMuseUsage() : Promise.resolve()
      ]),
    [
      claudeScanState,
      claudeApiScanState,
      deepSeekScanState,
      codexScanState,
      openCodeScanState,
      museScanState,
      refreshClaudeUsage,
      refreshClaudeApiUsage,
      refreshDeepSeekUsage,
      refreshCodexUsage,
      refreshOpenCodeUsage,
      refreshMuseUsage
    ]
  )

  const enable = useCallback(
    (id: UsageProviderId): Promise<void> => {
      const enableById: Record<UsageProviderId, () => Promise<void>> = {
        claude: enableClaudeUsage,
        'claude-api': enableClaudeApiUsage,
        deepseek: enableDeepSeekUsage,
        codex: enableCodexUsage,
        opencode: enableOpenCodeUsage,
        muse: enableMuseUsage
      }
      return enableById[id]()
    },
    [
      enableClaudeUsage,
      enableClaudeApiUsage,
      enableDeepSeekUsage,
      enableCodexUsage,
      enableOpenCodeUsage,
      enableMuseUsage
    ]
  )

  return { input, refreshEnabled, enable }
}
