import { defineMethod } from '../core'
import { StorageGcParams } from '../../../../shared/rpc-contract/storage-params'
import { getDaemonHistoryDir } from '../../../daemon/daemon-launch-paths'
import { removeTerminalHistorySessionTrees } from '../../../daemon/terminal-history-session-tombstone'
import { runTerminalHistoryGc } from '../../../daemon/terminal-history-gc-run'
import { DEFAULT_STORAGE_GC_POLICY } from '../../../daemon/terminal-history-session-retention'

const DAY_MS = 24 * 60 * 60 * 1000

export const STORAGE_METHODS = [
  defineMethod({
    name: 'storage.gc',
    params: StorageGcParams,
    handler: async (params, { runtime }) => {
      // Why lazy: see diagnostics.ts; the inventory must not load with the RPC method table.
      const { listDaemonSessionInventory } =
        await import('../../../daemon/daemon-session-inventory')
      const basePath = getDaemonHistoryDir()
      return await runTerminalHistoryGc(
        {
          basePath,
          listDaemonSessions: listDaemonSessionInventory,
          readPersistedWorkspaceSessions: () => runtime.readPersistedWorkspaceSessions(),
          removeSessionTree: (sessionId) => removeTerminalHistorySessionTrees(basePath, sessionId)
        },
        {
          // Why dry run unless asked: deletion must be an explicit choice, never a default.
          dryRun: params.dryRun !== false,
          policy: {
            maxAgeMs:
              params.olderThanDays === undefined
                ? DEFAULT_STORAGE_GC_POLICY.maxAgeMs
                : params.olderThanDays * DAY_MS,
            maxTotalBytes: params.maxTotalBytes ?? DEFAULT_STORAGE_GC_POLICY.maxTotalBytes
          }
        }
      )
    }
  })
]
