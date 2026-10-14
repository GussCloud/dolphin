import { useEffect, useRef, useState } from 'react'
import { getWhatsNewDecision } from '../components/whats-new/whats-new-decision'
import { shouldShowOnboarding } from '../components/onboarding/should-show-onboarding'
import { useAppStore } from '../store'
import type { OnboardingState } from '../../../shared/onboarding-state-types'

/**
 * Opens the one-time "What's new" dialog for the newest unseen release. It shares the single
 * modal slot with feature tips, so tips wait until it closes instead of stacking.
 */
export function useWhatsNew(onboarding: OnboardingState | null): void {
  const [appVersion, setAppVersion] = useState<string | null>(null)
  const handledRef = useRef(false)
  const persistedUIReady = useAppStore((s) => s.persistedUIReady)
  const settings = useAppStore((s) => s.settings)
  const activeModal = useAppStore((s) => s.activeModal)

  useEffect(() => {
    if (!persistedUIReady) {
      return
    }
    let cancelled = false
    void window.api.updater
      .getVersion()
      .then((version) => {
        if (!cancelled) {
          setAppVersion(version)
        }
      })
      .catch(() => {
        // Why: an unknown version means no announcement; it must never block startup.
      })
    return () => {
      cancelled = true
    }
  }, [persistedUIReady])

  useEffect(() => {
    if (handledRef.current || !persistedUIReady || !settings || onboarding === null) {
      return
    }
    const decision = getWhatsNewDecision({
      appVersion,
      lastSeenVersion: settings.lastSeenWhatsNewVersion,
      onboardingVisible: shouldShowOnboarding(onboarding)
    })
    if (decision.kind === 'skip') {
      return
    }
    const { updateSettings, openModal } = useAppStore.getState()
    if (decision.kind === 'record') {
      handledRef.current = true
      void updateSettings({ lastSeenWhatsNewVersion: decision.version })
      return
    }
    // Why: read the live slot; another startup prompt may have taken it in this same commit.
    if (useAppStore.getState().activeModal !== 'none') {
      return
    }
    handledRef.current = true
    // Why: mark seen on show so a quit/crash before dismiss doesn't reopen it next launch.
    void updateSettings({ lastSeenWhatsNewVersion: decision.release.version })
    openModal('whats-new', { releaseId: decision.release.id, version: decision.release.version })
  }, [activeModal, appVersion, onboarding, persistedUIReady, settings])
}
