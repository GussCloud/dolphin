import type { AgentHookEventPayload } from '../../../shared/agent-hook-listener/listener-event'

/** A child's own event: one naming its agent id, or a teammate's idle, which names it by `teammate_name` only. */
export function isChildAttributedHookEvent(
  event: Pick<AgentHookEventPayload, 'toolAgentId' | 'hookEventName'>
): boolean {
  return event.toolAgentId !== undefined || event.hookEventName === 'TeammateIdle'
}
