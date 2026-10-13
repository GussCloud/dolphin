import type { TerminalTab } from '../../shared/terminal-tab-types'
import { agentHookServer } from '../agent-hooks/server'
import type { Store } from '../persistence'
import {
  getDolphinCloudAuthConfig,
  isDolphinCloudDevAuthEnabled
} from '../dolphin-profiles/profile-cloud-auth-config'
import { getProfileUserDataPath } from '../dolphin-profiles/profile-storage-paths'
import { settleWithinMs } from '../quit-teardown-deadline'
import { readInstallId } from '../telemetry/install-id'
import { startWorkPresenceService } from '../work-presence/work-presence-service'
import { mainProcessState as state } from './main-process-state'

// Why 3s: the goodbye only speeds up the console's "left" animation; liveness expiry covers a miss.
const WORK_PRESENCE_QUIT_DEADLINE_MS = 3_000

let stopWorkPresence: (() => Promise<void>) | null = null

// Why every host partition: SSH workspaces keep their tabs in their own session partition.
function collectTerminalTabsById(store: Store | null): Map<string, TerminalTab> {
  const tabsById = new Map<string, TerminalTab>()
  for (const hostId of store?.getWorkspaceSessionHostIds() ?? []) {
    for (const tabs of Object.values(store?.getWorkspaceSession(hostId).tabsByWorktree ?? {})) {
      for (const tab of tabs) {
        tabsById.set(tab.id, tab)
      }
    }
  }
  return tabsById
}

/** Publishes this machine's agents to the console work view while a cloud session exists. */
export function startWorkPresencePublishing(): void {
  const runtime = state.runtime
  const cloudAuth = getDolphinCloudAuthConfig()
  // Why skip dev auth: it fakes the session locally, so the API would reject every request.
  if (stopWorkPresence || !runtime || !cloudAuth.configured || isDolphinCloudDevAuthEnabled()) {
    return
  }
  try {
    stopWorkPresence = startWorkPresenceService({
      config: cloudAuth.config,
      userDataPath: getProfileUserDataPath(),
      getInstallId: () => (state.store ? readInstallId(state.store) : undefined),
      getWorktreePs: (limit) => runtime.getWorktreePs(limit),
      getAgentNameSources: () => ({
        teammateNamesByPaneKey: runtime.getClaudeAgentTeammateNamesByPaneKey(),
        tabsById: collectTerminalTabsById(state.store)
      }),
      subscribeStatusChanges: (listener) => agentHookServer.subscribeStatusChanges(listener)
    }).stop
  } catch (error) {
    console.warn(
      '[work-presence] Startup unavailable:',
      error instanceof Error ? error.message : String(error)
    )
  }
}

export async function stopWorkPresencePublishing(): Promise<void> {
  const stop = stopWorkPresence
  stopWorkPresence = null
  if (stop) {
    await settleWithinMs(stop(), WORK_PRESENCE_QUIT_DEADLINE_MS)
  }
}
