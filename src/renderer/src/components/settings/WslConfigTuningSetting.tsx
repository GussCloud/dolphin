import { useCallback, useEffect, useState } from 'react'
import type {
  WslConfigAnalysis,
  WslConfigApplyResult,
  WslConfigSuggestion
} from '../../../../shared/wslconfig-tuning-types'
import { Button } from '../ui/button'
import { SearchableSetting } from './SearchableSetting'
import { SettingsRow } from './SettingsFormControls'
import { getWslConfigTuningSearchEntry } from './general-project-runtime-search'
import { translate } from '@/i18n/i18n'

type WslConfigTuningSettingProps = {
  wslSupportedPlatform: boolean
}

function suggestionReason(suggestion: WslConfigSuggestion, totalMemoryGb: number): string {
  if (suggestion.id === 'auto-memory-reclaim') {
    return translate(
      'auto.components.settings.WslConfigTuningSetting.autoMemoryReclaimReason',
      'Returns idle WSL and Docker cache memory to Windows instead of holding it until shutdown.'
    )
  }
  if (suggestion.id === 'sparse-vhd') {
    return translate(
      'auto.components.settings.WslConfigTuningSetting.sparseVhdReason',
      'New WSL disks give freed space back to Windows. Existing disks are not changed.'
    )
  }
  return translate(
    'auto.components.settings.WslConfigTuningSetting.memoryCapReason',
    'The current limit ({{value0}}) lets WSL take most of this machine’s {{value1}} GB, starving Windows apps.',
    { value0: suggestion.currentValue ?? '', value1: totalMemoryGb }
  )
}

function analysisDescription(
  analysis: Exclude<WslConfigAnalysis, { state: 'unsupported' }>
): string {
  if (analysis.state === 'unreadable') {
    return translate(
      'auto.components.settings.WslConfigTuningSetting.unreadable',
      'Dolphin could not safely read {{value0}}, so it will not change it. Edit it by hand.',
      { value0: analysis.configPath }
    )
  }
  if (analysis.suggestions.length === 0) {
    return translate(
      'auto.components.settings.WslConfigTuningSetting.upToDate',
      '{{value0}} already uses the recommended memory settings.',
      { value0: analysis.configPath }
    )
  }
  return translate(
    'auto.components.settings.WslConfigTuningSetting.hasSuggestions',
    'Suggested changes for {{value0}}. Your other settings and comments are kept, and the current file is backed up first.',
    { value0: analysis.configPath }
  )
}

function applyResultMessage(result: WslConfigApplyResult): string {
  if (result.ok) {
    return translate(
      'auto.components.settings.WslConfigTuningSetting.applied',
      'Saved. Run "wsl --shutdown" when convenient to apply it — that stops every running distro and Docker container.'
    )
  }
  return translate(
    'auto.components.settings.WslConfigTuningSetting.applyFailed',
    'Could not update .wslconfig. Nothing was changed.'
  )
}

export function WslConfigTuningSetting({
  wslSupportedPlatform
}: WslConfigTuningSettingProps): React.JSX.Element | null {
  const [analysis, setAnalysis] = useState<WslConfigAnalysis | null>(null)
  const [applying, setApplying] = useState(false)
  const [applyResult, setApplyResult] = useState<WslConfigApplyResult | null>(null)

  useEffect(() => {
    if (!wslSupportedPlatform) {
      return
    }
    let cancelled = false
    void window.api.wslConfigTuning
      .analyze()
      .then((next) => {
        if (!cancelled) {
          setAnalysis(next)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAnalysis({ state: 'unsupported' })
        }
      })
    return () => {
      cancelled = true
    }
  }, [wslSupportedPlatform])

  const handleApply = useCallback(async (): Promise<void> => {
    if (analysis?.state !== 'ready') {
      return
    }
    setApplying(true)
    try {
      const result = await window.api.wslConfigTuning.apply(
        analysis.suggestions.map((suggestion) => suggestion.id)
      )
      setApplyResult(result)
      setAnalysis(await window.api.wslConfigTuning.analyze())
    } catch {
      setApplyResult({ ok: false, reason: 'write-failed', configPath: analysis.configPath })
    } finally {
      setApplying(false)
    }
  }, [analysis])

  if (!wslSupportedPlatform || !analysis || analysis.state === 'unsupported') {
    return null
  }
  const suggestions = analysis.state === 'ready' ? analysis.suggestions : []
  const searchEntry = getWslConfigTuningSearchEntry()

  return (
    <SearchableSetting {...searchEntry} className="space-y-3">
      <SettingsRow
        label={searchEntry.title}
        alignTop
        description={analysisDescription(analysis)}
        control={
          suggestions.length > 0 ? (
            <Button
              variant="outline"
              size="sm"
              disabled={applying}
              onClick={() => void handleApply()}
            >
              {translate(
                'auto.components.settings.WslConfigTuningSetting.apply',
                'Apply to .wslconfig'
              )}
            </Button>
          ) : null
        }
      />
      {analysis.state === 'ready' && suggestions.length > 0 ? (
        <>
          <ul className="space-y-2">
            {suggestions.map((suggestion) => (
              <li key={suggestion.id} className="space-y-0.5">
                <div className="font-mono text-xs">
                  [{suggestion.section}] {suggestion.key}={suggestion.suggestedValue}
                </div>
                <p className="text-xs text-muted-foreground">
                  {suggestionReason(suggestion, analysis.totalMemoryGb)}
                </p>
              </li>
            ))}
          </ul>
          <pre className="scrollbar-sleek max-h-48 overflow-auto rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs">
            {analysis.preview}
          </pre>
        </>
      ) : null}
      {applyResult?.ok ? (
        <p className="text-[11px] text-muted-foreground">{applyResultMessage(applyResult)}</p>
      ) : null}
      {applyResult && !applyResult.ok ? (
        <p className="text-[11px] text-destructive">{applyResultMessage(applyResult)}</p>
      ) : null}
    </SearchableSetting>
  )
}
