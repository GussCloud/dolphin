import { agentHookServer } from '../agent-hooks/server'
import { AgentInteractionController } from '../agent-interaction/agent-interaction-controller'
import { registerAgentInteractionAvatarHandlers } from '../ipc/agent-interaction-avatar'
import type { Store } from '../persistence'
import { presentAgentInteractionAvatar } from '../window/agent-interaction-avatar-window'
import { resolveWorkspaceDisplayName } from '../workspace-display-name'
import { mainProcessState as state } from './main-process-state'

/** Desktop only: serve mode can be promoted in place, so this is checked per frame, not once. */
function hasDesktopWindow(): boolean {
  return Boolean(state.mainWindow && !state.mainWindow.isDestroyed())
}

/** Feeds status-store writes to the avatar; the window itself is created on the first cue. */
export function startMainProcessAgentInteraction(store: Store): AgentInteractionController {
  const controller = new AgentInteractionController({
    getSettings: () => store.getSettings(),
    resolveWorkspaceLabel: (worktreeId) => resolveWorkspaceDisplayName(store, worktreeId),
    presenter: {
      present: ({ view, soundKind }) => {
        if (!hasDesktopWindow()) {
          return
        }
        const volume = store.getSettings().agentInteraction.volume
        presentAgentInteractionAvatar({
          view,
          ...(soundKind ? { sound: { kind: soundKind, volume } } : {})
        })
      },
      hide: () => presentAgentInteractionAvatar({ view: null })
    }
  })
  controller.seed(agentHookServer.getStatusSnapshot())
  agentHookServer.subscribeEnrichedStatus((event) => controller.onStatus(event))
  agentHookServer.subscribeStatusDrop((paneKey) => controller.onPaneCleared(paneKey))
  agentHookServer.subscribePaneStatusClear((clear) => {
    // Why: a transient clear is lost contact with an SSH host, not evidence the agent is gone.
    if ('paneKey' in clear) {
      controller.onPaneCleared(clear.paneKey)
    }
  })
  store.onSettingsChanged((updates) => {
    if ('agentInteraction' in updates) {
      controller.onSettingsChanged()
    }
  })
  registerAgentInteractionAvatarHandlers(store, controller)
  return controller
}
