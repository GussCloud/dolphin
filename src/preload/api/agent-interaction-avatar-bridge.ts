import { ipcRenderer } from 'electron'
import {
  AGENT_INTERACTION_AVATAR_CHANNELS,
  type AgentInteractionAvatarFrame,
  type AgentInteractionAvatarSoundResult
} from '../../shared/agent-interaction-avatar-ipc'
import type { AgentInteractionKind } from '../../shared/agent-interaction-settings'

/** Only the avatar window gets answers; main ignores these calls from any other renderer. */
export type AgentInteractionAvatarApi = {
  getFrame: () => Promise<AgentInteractionAvatarFrame>
  onFrame: (callback: (frame: AgentInteractionAvatarFrame) => void) => () => void
  loadSound: (kind: AgentInteractionKind) => Promise<AgentInteractionAvatarSoundResult>
  activate: () => void
  dismiss: () => void
}

export const agentInteractionAvatarApi: AgentInteractionAvatarApi = {
  getFrame: () => ipcRenderer.invoke(AGENT_INTERACTION_AVATAR_CHANNELS.getFrame),
  onFrame: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, frame: AgentInteractionAvatarFrame): void =>
      callback(frame)
    ipcRenderer.on(AGENT_INTERACTION_AVATAR_CHANNELS.frame, listener)
    return () => ipcRenderer.removeListener(AGENT_INTERACTION_AVATAR_CHANNELS.frame, listener)
  },
  loadSound: (kind) => ipcRenderer.invoke(AGENT_INTERACTION_AVATAR_CHANNELS.loadSound, kind),
  activate: () => ipcRenderer.send(AGENT_INTERACTION_AVATAR_CHANNELS.activate),
  dismiss: () => ipcRenderer.send(AGENT_INTERACTION_AVATAR_CHANNELS.dismiss)
}
