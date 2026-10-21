import type { AgentInteractionCueView } from './agent-interaction-cue-queue'
import type { AgentInteractionKind } from './agent-interaction-settings'
import type { NotificationSoundDataResult } from './notification-settings-types'

/** What the avatar window renders; `view: null` means nothing is waiting. */
export type AgentInteractionAvatarFrame = {
  view: AgentInteractionCueView | null
  /** Present only on the frame that announces a new cue; the renderer plays it once. */
  sound?: { kind: AgentInteractionKind; volume: number }
}

export type AgentInteractionAvatarSoundResult =
  | NotificationSoundDataResult
  | { ok: false; reason: 'silent' | 'disabled' }

export const AGENT_INTERACTION_AVATAR_CHANNELS = {
  frame: 'agentInteractionAvatar:frame',
  getFrame: 'agentInteractionAvatar:getFrame',
  loadSound: 'agentInteractionAvatar:loadSound',
  activate: 'agentInteractionAvatar:activate',
  dismiss: 'agentInteractionAvatar:dismiss'
} as const
