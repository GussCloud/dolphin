import { useEffect } from 'react'
import { useAppStore } from '@/store'
import { getActiveRuntimeTarget } from '@/runtime/runtime-client-target'
import { subscribeRuntimeClientEvents } from '@/runtime/runtime-client-events'
import { fetchRepoCatalogForTarget } from '@/store/repos/repo-catalog-merge'
import type { RuntimeClientEvent } from '../../../../shared/runtime-client-events'
import type { DesignListEntry } from '../../../../shared/design-types'
import { designIndexStore, refreshDesignIndexIfSubscribed } from './design-index'

/** Repo ids the list names that the pop-out's own store cannot resolve to a project name yet. */
export function missingDesignRepoIds(
  designs: readonly Pick<DesignListEntry, 'repoId'>[],
  knownRepoIds: ReadonlySet<string>
): string[] {
  const missing = new Set<string>()
  for (const design of designs) {
    if (design.repoId && !knownRepoIds.has(design.repoId)) {
      missing.add(design.repoId)
    }
  }
  return [...missing].sort()
}

/** Remote hosts have no IPC channel to this window; their change signal arrives as a client event. */
export function handleDesignPopoutClientEvent(event: RuntimeClientEvent): void {
  if (event.type === 'designsChanged') {
    void refreshDesignIndexIfSubscribed()
  }
}

/**
 * The pop-out has no app shell, so nothing else fills its store with projects or
 * listens to a remote host. Loads the catalog only when a design names a project
 * the store does not know, so steady-state cost is zero.
 */
export function useDesignPopoutHostSync(): void {
  const settingsReady = useAppStore((state) => state.settings !== null)
  const environmentId = useAppStore((state) => state.settings?.activeRuntimeEnvironmentId ?? null)

  useEffect(() => {
    if (!settingsReady) {
      return
    }
    let disposed = false
    let loading = false
    let settledKey: string | null = null
    const target = getActiveRuntimeTarget({ activeRuntimeEnvironmentId: environmentId })
    const missingKey = (): string => {
      const knownRepoIds = new Set(useAppStore.getState().repos.map((repo) => repo.id))
      return missingDesignRepoIds(designIndexStore.getState().designs, knownRepoIds).join('\n')
    }
    const reconcile = (): void => {
      const key = missingKey()
      // Why the settled key: a project deleted on the host stays missing; retry per new set, not per change.
      if (disposed || loading || key === '' || key === settledKey) {
        return
      }
      loading = true
      fetchRepoCatalogForTarget(target)
        .then(
          (catalog) => {
            if (!disposed) {
              useAppStore.setState({ repos: [...catalog.repos] })
            }
          },
          (error: unknown) => console.warn('[design-popout] could not load projects:', error)
        )
        .finally(() => {
          loading = false
          settledKey = missingKey()
        })
    }
    useAppStore.setState({ repos: [] })
    reconcile()
    const stopIndex = designIndexStore.subscribe(reconcile)

    let stopClientEvents: (() => void) | null = null
    if (environmentId) {
      void subscribeRuntimeClientEvents(environmentId, handleDesignPopoutClientEvent).then(
        (subscription) => {
          if (disposed) {
            subscription.unsubscribe()
          } else {
            stopClientEvents = subscription.unsubscribe
          }
        },
        (error: unknown) => console.warn('[design-popout] remote change events unavailable:', error)
      )
    }
    return () => {
      disposed = true
      stopIndex()
      stopClientEvents?.()
    }
  }, [settingsReady, environmentId])
}
