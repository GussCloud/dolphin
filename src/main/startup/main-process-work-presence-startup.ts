import { agentHookServer } from '../agent-hooks/server'
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
