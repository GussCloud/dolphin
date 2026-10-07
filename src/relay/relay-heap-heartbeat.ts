import { startProcessHeapHeartbeat } from '../main/diagnostics/process-heap-heartbeat'
import { relayLogLine } from './relay-diagnostic-log'

/** Same heap heartbeat as main/daemon/dolphind, written to the remote relay.log. */
export function startRelayHeapHeartbeat(
  readSessionCount: () => number,
  intervalMs?: number
): () => void {
  return startProcessHeapHeartbeat({
    emit: (fields) => relayLogLine(`[relay] heap-heartbeat ${JSON.stringify(fields)}`),
    readSessionCount,
    intervalMs
  })
}
