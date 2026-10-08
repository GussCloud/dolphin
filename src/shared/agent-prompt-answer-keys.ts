import {
  resolveNativeChatTranscriptAgent,
  shouldStepNativeChatAskAnswer
} from './native-chat-agent-support'
import {
  buildAskAnswerKeys,
  buildCodexAskAnswerKeys,
  formatAskAnswer,
  type AskAnswerKeyGroup,
  type AskAnswerSelection,
  type AskPrompt
} from './native-chat-ask'

// Keystrokes that answer an agent's TUI prompt, shared by every remote answer
// surface (desktop native chat, mobile, Telegram). Transport stays per caller.

/** Approval keys are complete control sequences: write them with `enter: false`. */
export const APPROVAL_ALLOW_KEYS = '1'
export const APPROVAL_DENY_KEYS = String.fromCharCode(27)

export type ApprovalEnvelope = { tool: string; summary?: string }

/** Parse the `{ approval: { tool, summary } }` interactivePrompt a PermissionRequest hook emits. */
export function parseApprovalEnvelope(
  interactivePrompt: string | undefined | null
): ApprovalEnvelope | null {
  if (!interactivePrompt) {
    return null
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(interactivePrompt)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || !('approval' in parsed)) {
    return null
  }
  const approval = parsed.approval
  if (!approval || typeof approval !== 'object' || !('tool' in approval)) {
    return null
  }
  const tool = approval.tool
  if (typeof tool !== 'string' || tool.length === 0) {
    return null
  }
  const summary = 'summary' in approval ? approval.summary : undefined
  return typeof summary === 'string' && summary.length > 0 ? { tool, summary } : { tool }
}

/** How an AskUserQuestion answer reaches the agent: paced selector keystrokes, or a pasted
 *  label line committed with Enter for agents whose question tool reads typed text. */
export type AskAnswerDelivery =
  | { kind: 'keys'; groups: AskAnswerKeyGroup[] }
  | { kind: 'paste'; text: string }

export function planAskAnswerDelivery(
  agent: string | null | undefined,
  prompt: AskPrompt,
  selections: AskAnswerSelection[]
): AskAnswerDelivery {
  if (!shouldStepNativeChatAskAnswer(agent)) {
    return { kind: 'paste', text: formatAskAnswer(prompt, selections) }
  }
  return {
    kind: 'keys',
    groups:
      resolveNativeChatTranscriptAgent(agent) === 'codex'
        ? buildCodexAskAnswerKeys(prompt, selections)
        : buildAskAnswerKeys(prompt, selections)
  }
}

/** Raw keystrokes have no paste framing, so an embedded newline would submit early. */
export function collapseTypedAnswerLineBreaks(text: string): string {
  return text.replace(/[\r\n]+/g, ' ')
}

/** The bytes one key group writes (`enter: false`); free text is collapsed to one line. */
export function askAnswerKeyGroupBytes(group: AskAnswerKeyGroup): string {
  return 'raw' in group ? group.raw : collapseTypedAnswerLineBreaks(group.text)
}
