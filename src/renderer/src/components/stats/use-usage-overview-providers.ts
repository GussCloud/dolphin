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
  const fetchDeepSeekUsage = useAppStore((state) => state.fetchDeepSeekUsage)
  const fetchCodexUsage = useAppStore((state) => state.fetchCodexUsage)
  const fetchOpenCodeUsage = useAppStore((state) => state.fetchOpenCodeUsage)
  const fetchMuseUsage = useAppStore((state) => state.fetchMuseUsage)
  const refreshClaudeUsage = useAppStore((state) => state.refreshClaudeUsage)
  const refreshDeepSeekUsage = useAppStore((state) => state.refreshDeepSeekUsage)
  const refreshCodexUsage = useAppStore((state) => state.refreshCodexUsage)
  const refreshOpenCodeUsage = useAppStore((state) => state.refreshOpenCodeUsage)
  const refreshMuseUsage = useAppStore((state) => state.refreshMuseUsage)
  const enableClaudeUsage = useAppStore((state) => state.enableClaudeUsage)
  const enableDeepSeekUsage = useAppStore((state) => state.enableDeepSeekUsage)
  const enableCodexUsage = useAppStore((state) => state.enableCodexUsage)
  const enableOpenCodeUsage = useAppStore((state) => state.enableOpenCodeUsage)
  const enableMuseUsage = useAppStore((state) => state.enableMuseUsage)

  useEffect(() => {
    void fetchClaudeUsage()
    void fetchDeepSeekUsage()
    void fetchCodexUsage()
    void fetchOpenCodeUsage()
    void fetchMuseUsage()
  }, [fetchClaudeUsage, fetchDeepSeekUsage, fetchCodexUsage, fetchOpenCodeUsage, fetchMuseUsage])

  const input = useMemo<UsageOverviewInput>(
    () => ({
      claude: { scanState: claudeScanState, summary: claudeSummary, daily: claudeDaily },
      deepseek: { scanState: deepSeekScanState, summary: deepSeekSummary, daily: deepSeekDaily },
      codex: { scanState: codexScanState, summary: codexSummary, daily: codexDaily },
      opencode: { scanState: openCodeScanState, summary: openCodeSummary, daily: openCodeDaily },
      muse: { scanState: museScanState, summary: museSummary, daily: museDaily }
    }),
    [
      claudeDaily,
      claudeScanState,
      claudeSummary,
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
        deepSeekScanState?.enabled ? refreshDeepSeekUsage() : Promise.resolve(),
        codexScanState?.enabled ? refreshCodexUsage() : Promise.resolve(),
        openCodeScanState?.enabled ? refreshOpenCodeUsage() : Promise.resolve(),
        museScanState?.enabled ? refreshMuseUsage() : Promise.resolve()
      ]),
    [
      claudeScanState,
      deepSeekScanState,
      codexScanState,
      openCodeScanState,
      museScanState,
      refreshClaudeUsage,
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
        deepseek: enableDeepSeekUsage,
        codex: enableCodexUsage,
        opencode: enableOpenCodeUsage,
        muse: enableMuseUsage
      }
      return enableById[id]()
    },
    [enableClaudeUsage, enableDeepSeekUsage, enableCodexUsage, enableOpenCodeUsage, enableMuseUsage]
  )

  return { input, refreshEnabled, enable }
}
