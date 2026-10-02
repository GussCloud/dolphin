import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store'
import { getOpenObserveCliStatus } from '@/lib/openobserve-host-client'
import type { OpenObserveCliStatus } from '../../../../shared/openobserve-cli'

export function useOpenObserveCliStatus(): {
  status: OpenObserveCliStatus | null
  loading: boolean
  loadError: string | null
  refresh: () => void
} {
  const activeRuntimeEnvironmentId = useAppStore((s) => s.settings?.activeRuntimeEnvironmentId)
  const [status, setStatus] = useState<OpenObserveCliStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  // Why: a slow probe from a previous host or click must not overwrite a newer one.
  const requestId = useRef(0)

  const refresh = useCallback(() => {
    const id = ++requestId.current
    setLoading(true)
    void getOpenObserveCliStatus({ activeRuntimeEnvironmentId })
      .then((next) => {
        if (id === requestId.current) {
          setStatus(next)
          setLoadError(null)
        }
      })
      .catch((error: unknown) => {
        if (id === requestId.current) {
          setStatus(null)
          setLoadError(error instanceof Error ? error.message : String(error))
        }
      })
      .finally(() => {
        if (id === requestId.current) {
          setLoading(false)
        }
      })
  }, [activeRuntimeEnvironmentId])

  useEffect(() => {
    // Why: switching hosts must not keep showing the previous host's CLI state.
    setStatus(null)
    refresh()
  }, [refresh])

  return { status, loading, loadError, refresh }
}
