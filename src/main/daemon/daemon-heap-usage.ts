import { isProcessHeapSample, type ProcessHeapSample } from '../../shared/process-heap-sample'
import { readProcessHeapSample } from '../diagnostics/process-heap-heartbeat'
import type { SessionInfo } from './types'

/** The daemon's self-reported memory, answered by the optional `heapUsage` request. */
export type DaemonHeapUsage = {
  heap: ProcessHeapSample
  liveSessionCount: number
}

export function countLiveDaemonSessions(sessions: readonly Pick<SessionInfo, 'isAlive'>[]): number {
  return sessions.reduce((count, session) => count + (session.isAlive ? 1 : 0), 0)
}

export function readDaemonHeapUsage(host: { listSessions(): SessionInfo[] }): DaemonHeapUsage {
  return {
    heap: readProcessHeapSample(),
    liveSessionCount: countLiveDaemonSessions(host.listSessions())
  }
}

/** Validates a reply from a daemon that may run a different build than this client. */
export function parseDaemonHeapUsage(value: unknown): DaemonHeapUsage | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const reply: Record<string, unknown> = { ...value }
  const { heap, liveSessionCount } = reply
  if (
    !isProcessHeapSample(heap) ||
    typeof liveSessionCount !== 'number' ||
    !Number.isInteger(liveSessionCount) ||
    liveSessionCount < 0
  ) {
    return null
  }
  return { heap, liveSessionCount }
}
