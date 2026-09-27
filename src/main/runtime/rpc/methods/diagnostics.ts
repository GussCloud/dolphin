import { defineMethod } from '../core'
import { collectRuntimeDiagnostics } from '../../../diagnostics/runtime-diagnostics'
import { getDaemonHistoryDir } from '../../../daemon/daemon-launch-paths'
import { scanTerminalHistorySessionTrees } from '../../../daemon/terminal-history-session-retention'

// Why lazy: the inventory pulls the daemon router and headless emulator, whose xterm polyfill
// installs a global `window` in every process that merely loads the RPC method table.
const loadDaemonSessionInventory = () => import('../../../daemon/daemon-session-inventory')

export const DIAGNOSTICS_METHODS = [
  defineMethod({
    name: 'diagnostics.memory',
    params: null,
    handler: async (_params, { runtime }) => {
      return await runtime.getMemorySnapshot()
    }
  }),
  defineMethod({
    name: 'diagnostics.runtime',
    params: null,
    handler: async (_params, { runtime }) => {
      const { isDaemonDegraded, listDaemonSessionInventory, readCurrentDaemonIdentity } =
        await loadDaemonSessionInventory()
      return await collectRuntimeDiagnostics({
        getMemorySnapshot: () => runtime.getMemorySnapshot(),
        listDaemonSessions: listDaemonSessionInventory,
        readDaemonPid: () => readCurrentDaemonIdentity()?.pid ?? null,
        isDaemonDegraded,
        readLocalPersistedWorkspaceSession: () => runtime.readPersistedWorkspaceSessions('local'),
        listRestorableSessionIds: async () =>
          new Set(
            (await scanTerminalHistorySessionTrees(getDaemonHistoryDir())).map((t) => t.sessionId)
          )
      })
    }
  })
]
