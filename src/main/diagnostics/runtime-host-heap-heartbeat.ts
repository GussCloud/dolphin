import { listRegisteredPtys } from '../memory/pty-registry'
import { startProcessHeapHeartbeat } from './process-heap-heartbeat'

/**
 * Heartbeat for the process that hosts the runtime (Electron main or dolphind). Each host
 * supplies its own log sink; the session count is the local PTYs it tracks.
 */
export function startRuntimeHostHeapHeartbeat(
  emit: (fields: Record<string, number>) => void
): () => void {
  return startProcessHeapHeartbeat({ emit, readSessionCount: () => listRegisteredPtys().length })
}
