import { defineMethod } from '../core'
import { collectRuntimeDiagnostics } from '../../../diagnostics/runtime-diagnostics'
import {
  isDaemonDegraded,
  listDaemonSessionInventory,
  readCurrentDaemonIdentity
} from '../../../daemon/daemon-session-inventory'

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
      return await collectRuntimeDiagnostics({
        getMemorySnapshot: () => runtime.getMemorySnapshot(),
        listDaemonSessions: listDaemonSessionInventory,
        readDaemonPid: () => readCurrentDaemonIdentity()?.pid ?? null,
        isDaemonDegraded
      })
    }
  })
]
