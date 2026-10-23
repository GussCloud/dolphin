import type { AgentHookEventPayload } from '../../../shared/agent-hook-listener/listener-event'
import { resolveDeepSeekDisplayAgentType } from '../../../shared/deepseek-status-identity'

/**
 * Decide the row's presentation identity once, at write time, so every reader (renderer, mobile,
 * `worktree ps`, dashboard) shows the same agent. The event's own stamp is never trusted: a relay
 * or an OSC payload could carry one, and only this host's transcript evidence decides.
 */
export function withHostDisplayAgentType<T extends AgentHookEventPayload>(
  previous: AgentHookEventPayload | undefined,
  event: T
): T {
  const displayAgentType = resolveDeepSeekDisplayAgentType({
    agentType: event.payload.agentType,
    transcriptPath: event.providerSession?.transcriptPath,
    previousDisplayAgentType:
      previous?.payload.agentType === event.payload.agentType
        ? previous?.payload.displayAgentType
        : undefined
  })
  if (displayAgentType === event.payload.displayAgentType) {
    return event
  }
  const { displayAgentType: _untrusted, ...payload } = event.payload
  return {
    ...event,
    payload: displayAgentType ? { ...payload, displayAgentType } : payload
  }
}
