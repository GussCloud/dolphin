import { useEffect, useState } from 'react'
import type { AzureCliSignInState } from '../../../../shared/azure-devops-auth'
import { getActiveRuntimeTarget } from '@/runtime/runtime-client-target'
import { useAppStore } from '@/store'

// Null when this client cannot sign in for the active host: the web client has no
// desktop API, and a remote host's `az login` cannot finish in this desktop's window.
export function useAzureCliSignInState(): AzureCliSignInState | null {
  const remote = useAppStore((s) => getActiveRuntimeTarget(s.settings).kind === 'environment')
  const [state, setState] = useState<AzureCliSignInState | null>(null)

  useEffect(() => {
    const api = window.api?.azureDevOps
    if (!api?.getCliSignInState || !api.onCliSignInStateChanged) {
      return
    }
    let disposed = false
    // Why subscribe first: a change published while the initial read is in flight must win.
    let changed = false
    const unsubscribe = api.onCliSignInStateChanged((next) => {
      changed = true
      setState(next)
    })
    void api
      .getCliSignInState()
      .then((initial) => {
        if (!disposed && !changed) {
          setState(initial)
        }
      })
      .catch(() => {})
    return () => {
      disposed = true
      unsubscribe()
    }
  }, [])

  return remote ? null : state
}
