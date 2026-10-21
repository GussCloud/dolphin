import needsInputSoundPath from '../../../resources/agent-interaction-sounds/needs-input.mp3?asset'
import needsPermissionSoundPath from '../../../resources/agent-interaction-sounds/needs-permission.mp3?asset'
import retryExhaustedSoundPath from '../../../resources/agent-interaction-sounds/retry-exhausted.mp3?asset'
import subagentAttentionSoundPath from '../../../resources/agent-interaction-sounds/subagent-attention.mp3?asset'
import subagentDoneSoundPath from '../../../resources/agent-interaction-sounds/subagent-done.mp3?asset'
import taskDoneSoundPath from '../../../resources/agent-interaction-sounds/task-done.mp3?asset'
import taskFailedSoundPath from '../../../resources/agent-interaction-sounds/task-failed.mp3?asset'
import taskInterruptedSoundPath from '../../../resources/agent-interaction-sounds/task-interrupted.mp3?asset'
import taskStartedSoundPath from '../../../resources/agent-interaction-sounds/task-started.mp3?asset'
import type {
  AgentInteractionKind,
  AgentInteractionSettings
} from '../../shared/agent-interaction-settings'
import { validateCustomSoundPath } from '../ipc/notification-sound-selection'

const BUNDLED_AGENT_INTERACTION_SOUNDS: Readonly<Record<AgentInteractionKind, string>> = {
  'needs-permission': needsPermissionSoundPath,
  'needs-input': needsInputSoundPath,
  'task-done': taskDoneSoundPath,
  'task-failed': taskFailedSoundPath,
  'task-interrupted': taskInterruptedSoundPath,
  'retry-exhausted': retryExhaustedSoundPath,
  'subagent-attention': subagentAttentionSoundPath,
  'subagent-done': subagentDoneSoundPath,
  'task-started': taskStartedSoundPath
}

export type AgentInteractionSoundSelection =
  | { path: string }
  | { path: null; reason: 'silent' | 'missing-path' | 'invalid-path' | 'unsupported-type' }

/** The file one event plays. A broken custom pick stays silent rather than guessing a fallback. */
export function getSelectedAgentInteractionSoundPath(
  settings: AgentInteractionSettings,
  kind: AgentInteractionKind
): AgentInteractionSoundSelection {
  const event = settings.events[kind]
  if (event.soundSource === 'none') {
    return { path: null, reason: 'silent' }
  }
  if (event.soundSource === 'default') {
    return { path: BUNDLED_AGENT_INTERACTION_SOUNDS[kind] }
  }
  const custom = validateCustomSoundPath(event.customSoundPath)
  return custom.path
    ? { path: custom.path }
    : { path: null, reason: custom.reason ?? 'missing-path' }
}
