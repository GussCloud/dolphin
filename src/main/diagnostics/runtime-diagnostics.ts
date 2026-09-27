import { arch, platform } from 'node:os'
import { getAppEnvironment } from '../../shared/app-environment'
import type { MemorySnapshot } from '../../shared/process-stats-types'
import type { RuntimeDiagnostics } from '../../shared/runtime-diagnostics-types'
import type { DaemonSessionInfo } from '../daemon/types'
import { listRegisteredPtys } from '../memory/pty-registry'
import { localPtySessionLifecycle } from '../session/session-lifecycle-ledger'
import { findSessionInconsistencies, probeLocalPid } from './session-inconsistencies'
import { listStorageFootprintRoots, measureStorageFootprint } from './storage-footprint'

export type RuntimeDiagnosticsDeps = {
  getMemorySnapshot: () => Promise<MemorySnapshot>
  /** Null inventory means no daemon provider is running at all. */
  listDaemonSessions: () => Promise<{ sessions: DaemonSessionInfo[]; complete: boolean } | null>
  readDaemonPid: () => number | null
  isDaemonDegraded: () => boolean
}

export async function collectRuntimeDiagnostics(
  deps: RuntimeDiagnosticsDeps
): Promise<RuntimeDiagnostics> {
  const env = getAppEnvironment()
  const [memory, inventory, storage] = await Promise.all([
    deps.getMemorySnapshot(),
    deps.listDaemonSessions().catch(() => ({ sessions: [], complete: false })),
    measureStorageFootprint(listStorageFootprintRoots(env.getPath('userData')))
  ])
  // Why no locking: a spawn racing the listing can surface once here; findings are only suspects.
  const registered = listRegisteredPtys()
  const daemonDegraded = deps.isDaemonDegraded()

  const daemonSessionsByState: Record<string, number> = {}
  let oldestCreatedAt: number | null = null
  for (const session of inventory?.sessions ?? []) {
    daemonSessionsByState[session.state] = (daemonSessionsByState[session.state] ?? 0) + 1
    // Why > 0: daemons that predate real timestamps report 0 for every session.
    if (
      session.createdAt > 0 &&
      (oldestCreatedAt === null || session.createdAt < oldestCreatedAt)
    ) {
      oldestCreatedAt = session.createdAt
    }
  }

  const completeSessions = inventory?.complete ? inventory.sessions : null
  return {
    collectedAt: Date.now(),
    runtime: {
      appVersion: env.getVersion(),
      platform: platform(),
      arch: arch(),
      mainPid: process.pid,
      uptimeMs: Math.round(process.uptime() * 1000),
      daemonPid: deps.readDaemonPid(),
      daemonDegraded
    },
    sessions: {
      registeredPtyCount: registered.length,
      daemonSessionCount: inventory ? inventory.sessions.length : null,
      daemonSessionsByState,
      daemonInventoryComplete: inventory?.complete ?? false,
      oldestDaemonSessionCreatedAt: oldestCreatedAt,
      inconsistencies: findSessionInconsistencies({
        registered: registered.map(({ ptyId, pid }) => ({ ptyId, pid })),
        daemonSessions: completeSessions,
        expectRegisteredInDaemon: !daemonDegraded,
        probePid: probeLocalPid
      }),
      localLifecycleByState: localPtySessionLifecycle.countByState(),
      rejectedLifecycleTransitions: localPtySessionLifecycle
        .list()
        .reduce((sum, record) => sum + record.rejectedTransitions, 0)
    },
    memory,
    storage
  }
}
