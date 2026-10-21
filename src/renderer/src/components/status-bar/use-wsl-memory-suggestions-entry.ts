import { useCallback, useEffect, useState } from 'react'
import { isWindowsUserAgent } from '@/components/terminal-pane/pane-helpers'
import { isWebClientLocation } from '@/lib/web-client-location'
import { useAppStore } from '../../store'

/** Pending .wslconfig suggestions for the resource manager footer; checked once per popover open. */
export function useWslMemorySuggestionsEntry(
  open: boolean,
  setOpen: (open: boolean) => void
): { suggestionCount: number; openPerformanceSettings: () => void } {
  const openSettingsTarget = useAppStore((state) => state.openSettingsTarget)
  const [suggestionCount, setSuggestionCount] = useState(0)
  // Why: .wslconfig belongs to the local Windows desktop; skip the IPC everywhere else.
  const eligible = isWindowsUserAgent() && !isWebClientLocation()

  useEffect(() => {
    if (!open || !eligible) {
      return
    }
    let cancelled = false
    void window.api.wslConfigTuning
      .analyze()
      .then((analysis) => {
        if (!cancelled) {
          setSuggestionCount(analysis.state === 'ready' ? analysis.suggestions.length : 0)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSuggestionCount(0)
        }
      })
    return () => {
      cancelled = true
    }
  }, [open, eligible])

  const openPerformanceSettings = useCallback((): void => {
    setOpen(false)
    queueMicrotask(() => openSettingsTarget({ pane: 'performance', repoId: null }))
  }, [openSettingsTarget, setOpen])

  return { suggestionCount, openPerformanceSettings }
}
