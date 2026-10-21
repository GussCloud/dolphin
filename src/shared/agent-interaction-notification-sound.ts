import type { AgentInteractionKind, AgentInteractionSettings } from './agent-interaction-settings'
import type { NotificationDispatchRequest } from './notification-settings-types'

/** The interaction event a notification announces; null for sources the avatar never shows. */
export function agentInteractionKindForNotification(
  request: Pick<NotificationDispatchRequest, 'source' | 'agentState' | 'agentInterrupted'>
): AgentInteractionKind | null {
  if (request.source === 'agent-auto-retry-exhausted') {
    return 'retry-exhausted'
  }
  if (request.source !== 'agent-task-complete') {
    return null
  }
  if (request.agentState === 'blocked') {
    return 'needs-permission'
  }
  if (request.agentState === 'waiting') {
    return 'needs-input'
  }
  return request.agentInterrupted ? 'task-interrupted' : 'task-done'
}

/** The avatar plays its own sound for this event, so the notification must stay quiet. */
export function isNotificationSoundOwnedByAgentInteraction(
  settings: AgentInteractionSettings | undefined,
  request: Pick<NotificationDispatchRequest, 'source' | 'agentState' | 'agentInterrupted'>
): boolean {
  const kind = agentInteractionKindForNotification(request)
  return Boolean(settings?.enabled && kind && settings.events[kind].enabled)
}
