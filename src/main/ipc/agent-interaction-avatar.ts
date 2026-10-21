import { ipcMain } from 'electron'
import {
  AGENT_INTERACTION_AVATAR_CHANNELS,
  AGENT_INTERACTION_VIEWED_WORKTREES_MAX,
  type AgentInteractionAvatarFrame,
  type AgentInteractionAvatarImageResult,
  type AgentInteractionAvatarSoundResult
} from '../../shared/agent-interaction-avatar-ipc'
import { isAgentInteractionKind } from '../../shared/agent-interaction-settings'
import type { AgentInteractionController } from '../agent-interaction/agent-interaction-controller'
import {
  getBundledAgentInteractionSoundPath,
  getSelectedAgentInteractionSoundPath
} from '../agent-interaction/agent-interaction-sound-selection'
import type { Store } from '../persistence'
import {
  isAgentInteractionAvatarRenderer,
  takeAgentInteractionAvatarInitialFrame
} from '../window/agent-interaction-avatar-window'
import { resolveAgentPaneReveal } from '../window/reveal-agent-pane'
import { readNotificationSoundFile } from './notification-sound-file'
import { isTrustedUIRenderer } from './ui'
import { readAgentInteractionAvatarImage } from '../agent-interaction/agent-interaction-avatar-image'

function isViewedWorktreeList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= AGENT_INTERACTION_VIEWED_WORKTREES_MAX &&
    value.every((item) => typeof item === 'string' && item.length > 0 && item.length <= 4096)
  )
}

/** Handlers answer the avatar window (and the settings page for previews); paths are chosen here, never sent in. */
export function registerAgentInteractionAvatarHandlers(
  store: Store,
  controller: AgentInteractionController
): void {
  ipcMain.removeHandler(AGENT_INTERACTION_AVATAR_CHANNELS.getFrame)
  ipcMain.handle(AGENT_INTERACTION_AVATAR_CHANNELS.getFrame, (event): AgentInteractionAvatarFrame => {
    if (!isAgentInteractionAvatarRenderer(event.sender)) {
      return { view: null }
    }
    return takeAgentInteractionAvatarInitialFrame({ view: controller.current() })
  })

  ipcMain.removeHandler(AGENT_INTERACTION_AVATAR_CHANNELS.loadSound)
  ipcMain.handle(
    AGENT_INTERACTION_AVATAR_CHANNELS.loadSound,
    async (event, kind: unknown): Promise<AgentInteractionAvatarSoundResult> => {
      const fromAvatar = isAgentInteractionAvatarRenderer(event.sender)
      if (!(fromAvatar || isTrustedUIRenderer(event.sender)) || !isAgentInteractionKind(kind)) {
        return { ok: false, reason: 'invalid-path' }
      }
      const settings = store.getSettings().agentInteraction
      // Why: the settings page previews sounds before the feature is switched on.
      if (fromAvatar && !settings.enabled) {
        return { ok: false, reason: 'disabled' }
      }
      const selected = getSelectedAgentInteractionSoundPath(settings, kind)
      if (selected.path === null && selected.reason === 'silent') {
        return { ok: false, reason: 'silent' }
      }
      const sound = selected.path ? await readNotificationSoundFile(selected.path) : null
      if (sound?.ok) {
        return sound
      }
      // Why: a custom file that was moved, deleted or mistyped must not turn the event silent.
      return readNotificationSoundFile(getBundledAgentInteractionSoundPath(kind))
    }
  )

  ipcMain.removeHandler(AGENT_INTERACTION_AVATAR_CHANNELS.loadImage)
  ipcMain.handle(
    AGENT_INTERACTION_AVATAR_CHANNELS.loadImage,
    async (event): Promise<AgentInteractionAvatarImageResult> => {
      if (!isAgentInteractionAvatarRenderer(event.sender) && !isTrustedUIRenderer(event.sender)) {
        return { ok: false, reason: 'invalid-path' }
      }
      return readAgentInteractionAvatarImage(store.getSettings().agentInteraction)
    }
  )

  ipcMain.removeAllListeners(AGENT_INTERACTION_AVATAR_CHANNELS.activate)
  ipcMain.on(AGENT_INTERACTION_AVATAR_CHANNELS.activate, (event) => {
    const cue = isAgentInteractionAvatarRenderer(event.sender) ? controller.current()?.cue : null
    if (!cue) {
      return
    }
    controller.dismiss(cue.paneKey)
    resolveAgentPaneReveal(cue)?.()
  })

  ipcMain.removeAllListeners(AGENT_INTERACTION_AVATAR_CHANNELS.viewed)
  ipcMain.on(AGENT_INTERACTION_AVATAR_CHANNELS.viewed, (event, worktreeIds: unknown) => {
    if (!isTrustedUIRenderer(event.sender) || !isViewedWorktreeList(worktreeIds)) {
      return
    }
    controller.setViewedWorktrees(worktreeIds)
  })

  ipcMain.removeAllListeners(AGENT_INTERACTION_AVATAR_CHANNELS.dismiss)
  ipcMain.on(AGENT_INTERACTION_AVATAR_CHANNELS.dismiss, (event) => {
    const cue = isAgentInteractionAvatarRenderer(event.sender) ? controller.current()?.cue : null
    if (cue) {
      controller.dismiss(cue.paneKey)
    }
  })
}
