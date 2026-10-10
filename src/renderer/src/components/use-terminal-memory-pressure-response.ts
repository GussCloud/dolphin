import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import { subscribeRendererMemoryPressure } from '@/lib/renderer-memory-pressure'
import { releaseAllRetainedHiddenWebgl } from '@/lib/pane-manager/terminal-webgl-hidden-retention'
import { recordRendererCrashBreadcrumb } from '@/lib/crash-breadcrumb-recorder'

/**
 * Terminal workspace's answer to a renderer memory-pressure signal: drop every retained hidden
 * WebGL context now, and ask the next parking pass to shed all eligible hidden tabs past the
 * cold-park delay (the retention pass's sticky park, so they stay parked until revealed).
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
        const releasedWebglOwners = releaseAllRetainedHiddenWebgl()
        recordRendererCrashBreadcrumb('terminal_memory_pressure_shed', {
          releasedWebglOwners,
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
