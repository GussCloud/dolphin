import { useAppStore } from '@/store'
import { DOLPHIN_BROWSER_PARTITION } from '../../../../../shared/constants'
import { getDolphinProfileBrowserDefaultPartition } from '../../../../../shared/dolphin-profiles'

export function useBrowserPageWebviewPartition({
  sessionProfileId,
  sessionPartition
}: {
  sessionProfileId: string | null
  sessionPartition: string | null
}): string {
  const browserSessionProfiles = useAppStore((s) => s.browserSessionProfiles)
  const activeDolphinProfileId = useAppStore((s) => s.activeDolphinProfileId)
  const fallbackBrowserPartition = activeDolphinProfileId
    ? getDolphinProfileBrowserDefaultPartition(activeDolphinProfileId)
    : null
  const defaultSessionProfile = browserSessionProfiles.find((p) => p.id === 'default') ?? null
  const sessionProfile = sessionProfileId
    ? (browserSessionProfiles.find((p) => p.id === sessionProfileId) ?? null)
    : defaultSessionProfile
  return (
    sessionPartition ??
    sessionProfile?.partition ??
    defaultSessionProfile?.partition ??
    fallbackBrowserPartition ??
    DOLPHIN_BROWSER_PARTITION
  )
}
