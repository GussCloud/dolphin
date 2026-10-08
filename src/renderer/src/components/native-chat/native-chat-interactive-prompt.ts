import { translate } from '@/i18n/i18n'
import type {
  AgentJournalApprovalMatchedAskRule,
  AgentJournalApprovalSubject
} from '../../../../shared/agent-session-journal-types'
import {
  buildAskAnswerKeys,
  buildCodexAskAnswerKeys,
  formatAskAnswer,
  hasAskAnswer,
  parseAskFromStatus,
  registerQuestionTool,
  type AskAnswerKeyGroup,
  type AskAnswerSelection,
  type AskOption,
  type AskPrompt,
  type AskQuestion,
  type InteractiveQuestionParser
} from '../../../../shared/native-chat-ask'
import {
  APPROVAL_ALLOW_KEYS,
  APPROVAL_DENY_KEYS,
  parseApprovalEnvelope
} from '../../../../shared/agent-prompt-answer-keys'

export {
  buildAskAnswerKeys,
  buildCodexAskAnswerKeys,
  formatAskAnswer,
  hasAskAnswer,
  parseAskFromStatus,
  registerQuestionTool,
  type AskAnswerKeyGroup,
  type AskAnswerSelection,
  type AskOption,
  type AskPrompt,
  type AskQuestion,
  type InteractiveQuestionParser
}

export type ChatApproval = {
  title: string
  displayName?: string
  description?: string
  decisionReason?: string
  blockedPath?: string
  matchedAskRule?: AgentJournalApprovalMatchedAskRule
  subject?: AgentJournalApprovalSubject
  detail?: string
  options: { label: string; send: string }[]
}

export type InteractivePromptCard =
  | { kind: 'question'; prompt: AskPrompt }
  | { kind: 'approval'; approval: ChatApproval }
  | null

/** Parse the desktop-only approval envelope; question parsing stays cross-platform. */
export function parseApprovalFromStatus(
  interactivePrompt: string | undefined | null
): ChatApproval | null {
  const approval = parseApprovalEnvelope(interactivePrompt)
  if (!approval) {
    return null
  }
  return {
    title: translate('components.native-chat.approval.title', 'Allow {{value0}}?', {
      value0: approval.tool
    }),
    detail: approval.summary,
    options: [
      {
        label: translate('components.native-chat.approval.allow', 'Allow'),
        send: APPROVAL_ALLOW_KEYS
      },
      {
        label: translate('components.native-chat.approval.deny', 'Deny'),
        send: APPROVAL_DENY_KEYS
      }
    ]
  }
}

export function parseInteractivePrompt(
  interactivePrompt: string | undefined | null,
  toolName?: string
): InteractivePromptCard {
  const prompt = parseAskFromStatus(interactivePrompt, toolName)
  if (prompt) {
    return { kind: 'question', prompt }
  }
  const approval = parseApprovalFromStatus(interactivePrompt)
  return approval ? { kind: 'approval', approval } : null
}
