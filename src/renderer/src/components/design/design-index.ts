import { useEffect } from 'react'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { useAppStore } from '@/store'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { getActiveRuntimeTarget } from '@/runtime/runtime-client-target'
import { hasRuntimeRpcErrorCode } from '../../../../shared/runtime-rpc-error-code'
import type { Design, DesignListEntry, DesignStatus } from '../../../../shared/design-types'

export type DesignIndexState =
  | { kind: 'loading'; designs: DesignListEntry[] }
  | { kind: 'ready'; designs: DesignListEntry[] }
  /** The host predates `design.*`; distinct from an empty list so the page can say so. */
  | { kind: 'unsupported'; designs: [] }
  | { kind: 'error'; designs: DesignListEntry[]; message: string }

export const designIndexStore = createStore<DesignIndexState>(() => ({
  kind: 'loading',
  designs: []
}))

let subscribers = 0
let environmentId: string | null = null
let stopChangeEvents: (() => void) | null = null
let refreshSeq = 0

function target(): ReturnType<typeof getActiveRuntimeTarget> {
  return getActiveRuntimeTarget({ activeRuntimeEnvironmentId: environmentId ?? undefined })
}

export function isDesignMethodMissing(error: unknown): boolean {
  return hasRuntimeRpcErrorCode(error, 'method_not_found')
}

export async function refreshDesignIndex(): Promise<void> {
  const seq = ++refreshSeq
  try {
    const { designs } = await callRuntimeRpc<{ designs: DesignListEntry[] }>(
      target(),
      'design.list',
      {}
    )
    if (seq === refreshSeq) {
      designIndexStore.setState({ kind: 'ready', designs }, true)
    }
  } catch (error) {
    if (seq !== refreshSeq) {
      return
    }
    if (isDesignMethodMissing(error)) {
      designIndexStore.setState({ kind: 'unsupported', designs: [] }, true)
      return
    }
    const message = error instanceof Error ? error.message : String(error)
    // Why: keep the last good rows visible; a transient failure should not empty the page.
    designIndexStore.setState((state) => ({ kind: 'error', designs: state.designs, message }), true)
  }
}

/** Mounted by the Design page; refreshes on the host's change signal instead of polling. */
export function useDesignIndexSubscription(): void {
  const activeEnvironmentId = useAppStore(
    (state) => state.settings?.activeRuntimeEnvironmentId ?? null
  )
  useEffect(() => {
    if (environmentId !== activeEnvironmentId) {
      designIndexStore.setState({ kind: 'loading', designs: [] }, true)
    }
    environmentId = activeEnvironmentId
    subscribers += 1
    stopChangeEvents ??= window.api?.designs?.onChanged(() => void refreshDesignIndex()) ?? null
    void refreshDesignIndex()
    return () => {
      subscribers -= 1
      if (subscribers === 0) {
        stopChangeEvents?.()
        stopChangeEvents = null
      }
    }
  }, [activeEnvironmentId])
}

/** Client-event entry point for remote hosts; local desktop hosts signal via preload instead. */
export function refreshDesignIndexIfSubscribed(): Promise<void> {
  return subscribers > 0 ? refreshDesignIndex() : Promise.resolve()
}

export function useDesignIndex(): DesignIndexState {
  return useStore(designIndexStore, (state) => state)
}

export async function showDesign(id: string): Promise<Design> {
  const { design } = await callRuntimeRpc<{ design: Design }>(target(), 'design.show', { id })
  return design
}

export async function setDesignStatus(id: string, status: DesignStatus): Promise<void> {
  await callRuntimeRpc(target(), 'design.setStatus', { id, status })
  await refreshDesignIndex()
}
