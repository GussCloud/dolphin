import { useEffect, useState } from 'react'
import { getAzureDevOpsReviewerAvatar } from '@/lib/azure-devops-host-client'
import { useAppStore } from '@/store'

// Why: the same reviewers repeat across nearly every PR and the board remounts on each poll.
const avatarCache = new Map<string, string>()
const inFlight = new Map<string, Promise<string | null>>()

function loadAvatar(
  settings: Parameters<typeof getAzureDevOpsReviewerAvatar>[0],
  url: string
): Promise<string | null> {
  const hit = avatarCache.get(url)
  if (hit) {
    return Promise.resolve(hit)
  }
  let pending = inFlight.get(url)
  if (!pending) {
    pending = getAzureDevOpsReviewerAvatar(settings, url)
      .then((result) => {
        if (result.ok) {
          avatarCache.set(url, result.dataUri)
        }
        return result.ok ? result.dataUri : null
      })
      .finally(() => inFlight.delete(url))
    inFlight.set(url, pending)
  }
  return pending
}

/** Photo data URI, or undefined while loading and on failure so the initials fallback shows. */
export function useAzureReviewerAvatar(url: string): string | undefined {
  const settings = useAppStore((s) => s.settings)
  const [src, setSrc] = useState<string | undefined>(() => avatarCache.get(url))

  useEffect(() => {
    if (!url) {
      setSrc(undefined)
      return
    }
    const hit = avatarCache.get(url)
    if (hit) {
      setSrc(hit)
      return
    }
    let alive = true
    void loadAvatar(settings, url).then((uri) => {
      if (alive) {
        setSrc(uri ?? undefined)
      }
    })
    return () => {
      alive = false
    }
  }, [settings, url])

  return src
}
