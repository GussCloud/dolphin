import { lazy, Suspense, useState } from 'react'
import { useAppStore } from '@/store'
import { needsProjectAccountSetup } from '../../../../shared/project-account-setup'

// Why lazy: the accounts panel pulls a large graph; boot only pays for this check.
const LegacyProjectAccountsDialog = lazy(() => import('./LegacyProjectAccountsDialog'))

// Why session-only: "Later" asks again next launch; only Save or Keep defaults end the prompt.
const postponedThisSession = new Set<string>()

/** Opens the accounts prompt when a project from before per-project accounts is selected. */
export function LegacyProjectAccountsGate(): React.JSX.Element | null {
  const repo = useAppStore((s) => s.repos.find((entry) => entry.id === s.activeRepoId) ?? null)
  const activeModal = useAppStore((s) => s.activeModal)
  const remote = useAppStore((s) => Boolean(s.settings?.activeRuntimeEnvironmentId?.trim()))
  const [, setPostponed] = useState(0)
  if (
    !repo ||
    activeModal !== 'none' ||
    remote ||
    !needsProjectAccountSetup(repo) ||
    postponedThisSession.has(repo.id)
  ) {
    return null
  }
  return (
    <Suspense fallback={null}>
      <LegacyProjectAccountsDialog
        key={repo.id}
        repo={repo}
        onLater={() => {
          postponedThisSession.add(repo.id)
          setPostponed((count) => count + 1)
        }}
      />
    </Suspense>
  )
}
