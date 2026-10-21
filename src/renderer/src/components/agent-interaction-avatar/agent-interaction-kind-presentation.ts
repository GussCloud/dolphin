import {
  CircleCheck,
  CircleStop,
  CircleX,
  MessageCircleQuestion,
  Play,
  ShieldAlert,
  UserCheck,
  Users,
  WifiOff,
  type LucideIcon
} from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { AgentInteractionKind } from '../../../../shared/agent-interaction-settings'

/** Drives the badge color through a data attribute; the class list itself stays static. */
export type AgentInteractionTone = 'attention' | 'success' | 'failure' | 'neutral'

export type AgentInteractionKindPresentation = {
  icon: LucideIcon
  tone: AgentInteractionTone
  title: () => string
}

export const AGENT_INTERACTION_KIND_PRESENTATION: Readonly<
  Record<AgentInteractionKind, AgentInteractionKindPresentation>
> = {
  'needs-permission': {
    icon: ShieldAlert,
    tone: 'attention',
    title: () => translate('agentInteraction.kind.needsPermission', 'Needs your permission')
  },
  'needs-input': {
    icon: MessageCircleQuestion,
    tone: 'attention',
    title: () => translate('agentInteraction.kind.needsInput', 'Waiting for your answer')
  },
  'task-done': {
    icon: CircleCheck,
    tone: 'success',
    title: () => translate('agentInteraction.kind.taskDone', 'Task finished')
  },
  'task-failed': {
    icon: CircleX,
    tone: 'failure',
    title: () => translate('agentInteraction.kind.taskFailed', 'Task failed')
  },
  'task-interrupted': {
    icon: CircleStop,
    tone: 'neutral',
    title: () => translate('agentInteraction.kind.taskInterrupted', 'Task interrupted')
  },
  'retry-exhausted': {
    icon: WifiOff,
    tone: 'failure',
    title: () => translate('agentInteraction.kind.retryExhausted', 'Connection lost, retries used up')
  },
  'subagent-attention': {
    icon: Users,
    tone: 'attention',
    title: () => translate('agentInteraction.kind.subagentAttention', 'A subagent needs you')
  },
  'subagent-done': {
    icon: UserCheck,
    tone: 'success',
    title: () => translate('agentInteraction.kind.subagentDone', 'Subagent finished')
  },
  'task-started': {
    icon: Play,
    tone: 'neutral',
    title: () => translate('agentInteraction.kind.taskStarted', 'Task started')
  }
}
