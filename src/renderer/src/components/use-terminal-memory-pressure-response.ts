import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import { subscribeRendererMemoryPressure } from '@/lib/renderer-memory-pressure'
import { releaseAllRetainedHiddenWebgl } from '@/lib/pane-manager/terminal-webgl-hidden-retention'
import { suspendUnsuspendedHiddenTerminalRendering } from '@/lib/pane-manager/pane-manager-registry'
import { recordRendererCrashBreadcrumb } from '@/lib/crash-breadcrumb-recorder'

/**
 * Terminal workspace's answer to a renderer memory-pressure signal: drop every hidden WebGL
 * context now (retained LRU and tab-hidden managers, pinned tabs included; scrollback stays),
 * and ask the next parking pass to shed all eligible hidden tabs past the cold-park delay (the
 * retention pass's sticky park, so they stay parked until revealed).
 * A GPU-process signal drops the WebGL contexts only: parking frees renderer memory, not GPU.
 * Returns the one-shot request flag the retention pass consumes.
 */
export function useTerminalMemoryPressureResponse(
  setTerminalParkingRevision: Dispatch<SetStateAction<number>>
): { current: boolean } {
  const memoryPressureParkRequestedRef = useRef(false)
  useEffect(
    () =>
      subscribeRendererMemoryPressure((signal) => {
        // Why first: tab-hidden managers (incl. eviction-exempt tabs that never park) keep live
        // WebGL outside the retained LRU; suspending them puts it where the release below reaches.
        const suspendedTabHiddenManagers = suspendUnsuspendedHiddenTerminalRendering()
        const releasedWebglOwners = releaseAllRetainedHiddenWebgl()
        recordRendererCrashBreadcrumb('terminal_memory_pressure_shed', {
          releasedWebglOwners,
          suspendedTabHiddenManagers,
          trigger: signal.trigger
        })
        if (signal.trigger === 'gpu') {
          return
        }
        memoryPressureParkRequestedRef.current = true
        setTerminalParkingRevision((revision) => revision + 1)
      }),
    [setTerminalParkingRevision]
  )
  return memoryPressureParkRequestedRef
}
