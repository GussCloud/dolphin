import { arch, platform } from 'node:os'
import { getAppEnvironment } from '../../shared/app-environment'
import type { MemorySnapshot } from '../../shared/process-stats-types'
import type { RuntimeDiagnostics } from '../../shared/runtime-diagnostics-types'
import type { DaemonSessionInfo } from '../daemon/types'
import { listRegisteredPtys } from '../memory/pty-registry'
import { localPtySessionLifecycle } from '../session/session-lifecycle-ledger'
import { findSessionInconsistencies, probeLocalPid } from './session-inconsistencies'
import { evaluateMemoryBudget, readMemoryBudget } from './memory-budget'
import { listStorageFootprintRoots, measureStorageFootprint } from './storage-footprint'
import { collectReferencedSessionIds } from '../daemon/terminal-history-session-retention'
import { parsePtySessionId } from '../../shared/pty-session-id-format'
import { parseAppSshPtyId } from '../../shared/ssh-pty-id'

export type RuntimeDiagnosticsDeps = {
  getMemorySnapshot: () => Promise<MemorySnapshot>
  /** Null inventory means no daemon provider is running at all. */
  listDaemonSessions: () => Promise<{ sessions: DaemonSessionInfo[]; complete: boolean } | null>
  readDaemonPid: () => number | null
  isDaemonDegraded: () => boolean
  /** The local host's saved tabs; other hosts' tabs never bind to this daemon. */
  readLocalPersistedWorkspaceSession?: () => unknown
  /** Session ids with history on disk that a reopen could cold-restore. */
  listRestorableSessionIds?: () => Promise<ReadonlySet<string>>
}

// Why: closed-tab tombstones name ids no tab will reopen; they are not saved-tab references.
const CLOSED_TAB_RECORD_KEYS = new Set([
  'closedTerminalTabTombstonesByTabId',
  'terminalSurfaceTombstonesByPaneKey'
])

function withoutClosedTabRecords(persisted: unknown): unknown {
  if (Array.isArray(persisted)) {
    return persisted.map(withoutClosedTabRecords)
  }
  if (!persisted || typeof persisted !== 'object') {
    return persisted
  }
  return Object.fromEntries(
    Object.entries(persisted).filter(([key]) => !CLOSED_TAB_RECORD_KEYS.has(key))
  )
}

/** Local daemon session ids only: SSH and remote-runtime ids live on other hosts. */
function isLocalDaemonSessionId(value: string): boolean {
  return (
    !value.startsWith('remote:') &&
    parseAppSshPtyId(value) === null &&
    parsePtySessionId(value).worktreeId !== null
  )
}

export async function collectRuntimeDiagnostics(
  deps: RuntimeDiagnosticsDeps
): Promise<RuntimeDiagnostics> {
  const env = getAppEnvironment()
  const [memory, inventory, storage, restorable] = await Promise.all([
    deps.getMemorySnapshot(),
    deps.listDaemonSessions().catch(() => ({ sessions: [], complete: false })),
    measureStorageFootprint(listStorageFootprintRoots(env.getPath('userData'))),
    deps.listRestorableSessionIds?.().catch(() => undefined)
  ])
  const persisted = deps.readLocalPersistedWorkspaceSession?.()
  const referencedBySavedTabs =
    persisted === undefined
      ? undefined
      : collectReferencedSessionIds(withoutClosedTabRecords(persisted), isLocalDaemonSessionId)
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
      ...reconcileSessions({
        registered,
        completeSessions,
        daemonDegraded,
        referencedBySavedTabs,
        restorable
      }),
      localLifecycleByState: localPtySessionLifecycle.countByState(),
      rejectedLifecycleTransitions: localPtySessionLifecycle
        .list()
        .reduce((sum, record) => sum + record.rejectedTransitions, 0)
    },
    memory,
    memoryWarnings: evaluateMemoryBudget(memory, readMemoryBudget()),
    storage
  }
}

function reconcileSessions(args: {
  registered: readonly { ptyId: string; pid: number | null }[]
  completeSessions: readonly DaemonSessionInfo[] | null
  daemonDegraded: boolean
  referencedBySavedTabs: ReadonlySet<string> | undefined
  restorable: ReadonlySet<string> | undefined
}): Pick<RuntimeDiagnostics['sessions'], 'inconsistencies' | 'matchedSessionCount'> {
  const liveIds = new Set(
    (args.completeSessions ?? []).filter((s) => s.isAlive).map((s) => s.sessionId)
  )
  return {
    inconsistencies: findSessionInconsistencies({
      registered: args.registered.map(({ ptyId, pid }) => ({ ptyId, pid })),
      daemonSessions: args.completeSessions,
      expectRegisteredInDaemon: !args.daemonDegraded,
      probePid: probeLocalPid,
      ...(args.referencedBySavedTabs ? { referencedBySavedTabs: args.referencedBySavedTabs } : {}),
      ...(args.restorable ? { restorableSessionIds: args.restorable } : {})
    }),
    matchedSessionCount: args.registered.filter((pty) => liveIds.has(pty.ptyId)).length
  }
}
