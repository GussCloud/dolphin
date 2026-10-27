import { agentHookServer } from '../agent-hooks/server'
import { dispatchMainProcessNotification } from '../ipc/notifications'
import { createClosedPaneAgentReaper } from '../windows/closed-pane-agent-reaper'
import { readWindowsProcessIdentityTableFresh } from '../windows/windows-process-table'
import {
  terminateIdentifiedWindowsProcessTree,
  verifyWindowsDescendantSnapshotExit
} from '../windows-descendant-exit-verification'
import { terminateWindowsProcessTree } from '../windows-process-tree-kill'
import { runProcess } from '../../shared/child-process/run-process'
import { windowsSystem32Binary } from '../../shared/child-process/windows-system-binary'

const NETSTAT_TIMEOUT_MS = 1_000
const NETSTAT_MAX_OUTPUT_BYTES = 4 * 1024 * 1024

/** Windows only: POSIX pane closes already signal every process group on the tty. */
export function startMainProcessClosedPaneAgentReaper(): void {
  if (process.platform !== 'win32') {
    return
  }
  const reaper = createClosedPaneAgentReaper({
    readNetstat: async () => {
      const result = await runProcess({
        program: windowsSystem32Binary('netstat.exe'),
        args: ['-ano', '-p', 'tcp'],
        timeoutMs: NETSTAT_TIMEOUT_MS,
        maxOutputBytes: NETSTAT_MAX_OUTPUT_BYTES
      })
      return result.timedOut || result.code !== 0 ? null : result.stdout
    },
    readTable: readWindowsProcessIdentityTableFresh,
    terminateTree: async (root) => {
      const killed = await terminateIdentifiedWindowsProcessTree(root, {
        readTable: readWindowsProcessIdentityTableFresh,
        terminateTree: (target) =>
          terminateWindowsProcessTree(target.pid, { site: 'closed-pane-agent-reaper' })
      })
      if (!killed) {
        return false
      }
      // Why: taskkill resolves the same on a denial as on a kill; only a table read proves exit.
      const verdict = await verifyWindowsDescendantSnapshotExit(
        { root, descendants: [root], unidentifiedCount: 0, capturedAtMs: Date.now() },
        { readTable: readWindowsProcessIdentityTableFresh }
      )
      return verdict === 'exited'
    },
    onReaped: ({ paneKey, root }) => {
      console.warn(
        `[closed-pane-reaper] stopped ${root.name} (${root.pid}) for closed pane ${paneKey}`
      )
      void Promise.resolve(
        dispatchMainProcessNotification({
          source: 'orphan-agent-stopped',
          stoppedProcessLabel: `${root.name} (PID ${root.pid})`
        })
      ).catch((error: unknown) => console.warn('[closed-pane-reaper] notification failed', error))
    }
  })
  agentHookServer.setClosedPaneHookListener(reaper.onClosedPaneHook)
}
