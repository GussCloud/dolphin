import { translate } from '@/i18n/i18n'
import type { AgentInteractionKind } from '../../../../shared/agent-interaction-settings'

/** When each event fires, as the settings page explains it. */
export function describeAgentInteractionEvent(kind: AgentInteractionKind): string {
  switch (kind) {
    case 'needs-permission':
      return translate(
        'agentInteraction.settings.event.needsPermission',
        'An agent stops to ask approval for a tool or command.'
      )
    case 'needs-input':
      return translate(
        'agentInteraction.settings.event.needsInput',
        'An agent asks you a question or waits for a decision.'
      )
    case 'task-done':
      return translate(
        'agentInteraction.settings.event.taskDone',
        'An agent finishes its turn and is idle.'
      )
    case 'task-failed':
      return translate(
        'agentInteraction.settings.event.taskFailed',
        'A turn ends with a provider error such as a rate limit or billing problem.'
      )
    case 'task-interrupted':
      return translate(
        'agentInteraction.settings.event.taskInterrupted',
        'A turn is cancelled before it finishes.'
      )
    case 'retry-exhausted':
      return translate(
        'agentInteraction.settings.event.retryExhausted',
        'Automatic retries after a lost connection gave up.'
      )
    case 'subagent-attention':
      return translate(
        'agentInteraction.settings.event.subagentAttention',
        'A subagent or teammate needs permission or input.'
      )
    case 'subagent-done':
      return translate(
        'agentInteraction.settings.event.subagentDone',
        'A subagent or teammate finishes while the main agent keeps working.'
      )
    case 'task-started':
      return translate(
        'agentInteraction.settings.event.taskStarted',
        'An agent starts working on a new prompt.'
      )
  }
}
