// `design.*` conversation methods: the agent asks decisions and replies, the user answers and
// comments, and the inbox carries the user's side to the agent (the watchdog only nudges it to read).
import {
  DesignAckParams,
  DesignAnswerParams,
  DesignCommentParams,
  DesignDecideParams,
  DesignDecisionsFileSchema,
  DesignInboxParams,
  DesignReplyFileSchema,
  DesignReplyParams,
  DesignResendParams
} from '../../../../shared/rpc-contract/design-params'
import type { DesignInboxEntry } from '../../../../shared/design-types'
import { DesignRefusal } from '../../../designs/design-interaction'
import { expandDesignInbox } from '../../../designs/design-inbox'
import { getDesignStore } from '../../../designs/design-store-instance'
import { OrchestrationError } from '../../orchestration/orchestration-error'
import { defineMethod } from '../core'
import { parseDesignFile, requireBoundDesign, requireDesign } from './designs'

export function refusing<T>(run: () => T): T {
  try {
    return run()
  } catch (error) {
    if (error instanceof DesignRefusal) {
      throw new OrchestrationError(error.code, error.message)
    }
    throw error
  }
}

export const DESIGN_CONVERSATION_METHODS = [
  defineMethod({
    name: 'design.decide',
    params: DesignDecideParams,
    handler: (params, context) => {
      const design = requireBoundDesign(params.id, params.from, context)
      const { decisions } = parseDesignFile(
        DesignDecisionsFileSchema,
        params.decisions,
        'design_invalid_decisions',
        'Decisions'
      )
      return {
        decisions: refusing(() => getDesignStore().addDecisions(design.id, decisions))
      }
    }
  }),
  defineMethod({
    name: 'design.answer',
    params: DesignAnswerParams,
    handler: (params) => {
      const design = requireDesign(params.id)
      return {
        decision: refusing(() =>
          getDesignStore().answerDecision(design.id, {
            decisionId: params.decisionId,
            selected: params.selected,
            note: params.note
          })
        )
      }
    }
  }),
  defineMethod({
    name: 'design.comment',
    params: DesignCommentParams,
    handler: (params) => {
      const design = requireDesign(params.id)
      return {
        message: refusing(() =>
          getDesignStore().addComment(design.id, { blockId: params.blockId, text: params.text })
        )
      }
    }
  }),
  defineMethod({
    name: 'design.inbox',
    params: DesignInboxParams,
    handler: (
      params,
      context
    ): { designId: string; items: DesignInboxEntry[]; ackCommand: string | null } => {
      const design = requireBoundDesign(params.id, params.from, context)
      const items = expandDesignInbox(design)
      return {
        designId: design.id,
        items,
        ackCommand:
          items.length > 0
            ? `dolphin design ack --id ${design.id} --items ${items.map((item) => item.id).join(',')} --json`
            : null
      }
    }
  }),
  defineMethod({
    name: 'design.ack',
    params: DesignAckParams,
    handler: (params, context) => {
      const design = requireBoundDesign(params.id, params.from, context)
      return { acked: refusing(() => getDesignStore().ack(design.id, params.items)) }
    }
  }),
  defineMethod({
    name: 'design.reply',
    params: DesignReplyParams,
    handler: (params, context) => {
      const design = requireBoundDesign(params.id, params.from, context)
      const reply = parseDesignFile(
        DesignReplyFileSchema,
        params.reply,
        'design_invalid_reply',
        'Reply'
      )
      return { message: refusing(() => getDesignStore().addReply(design.id, reply)) }
    }
  }),
  defineMethod({
    name: 'design.resend',
    params: DesignResendParams,
    handler: (params) => {
      const design = requireDesign(params.id)
      if (design.paneKey === null) {
        throw new OrchestrationError(
          'design_agent_not_bound',
          `Design ${design.id} has no agent terminal to deliver to yet.`
        )
      }
      // Why no direct send: the store change wakes the inbox watchdog, which owns the composing and status
      // checks; the recorded force request lets it nudge an agent that never reports idle. Works unblocked too.
      getDesignStore().resend(design.id)
      return { design: requireDesign(design.id) }
    }
  })
]
