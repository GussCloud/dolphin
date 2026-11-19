import { z } from 'zod'
import { OptionalString, requiredString } from './rpc-param-primitives'
import {
  DESIGN_BLOCK_KINDS,
  DESIGN_CANVAS_MAX_BLOCKS_PER_GROUP,
  DESIGN_CANVAS_MAX_EDGES,
  DESIGN_CANVAS_MAX_GROUPS,
  DESIGN_COMPLETION_SUMMARY_MAX_CHARS,
  DESIGN_DECISION_MAX_OPEN,
  DESIGN_DECISION_MAX_OPTIONS,
  DESIGN_MESSAGE_MAX_CHARS,
  DESIGN_NAME_MAX_CHARS,
  DESIGN_REQUEST_MAX_CHARS,
  DESIGN_STATUSES,
  DESIGN_SUMMARY_MAX_CHARS,
  DESIGN_TEXT_MAX_CHARS
} from '../design-types'

const ElementId = z.string().trim().min(1).max(80)
const Title = z.string().trim().min(1).max(DESIGN_NAME_MAX_CHARS)

export const DesignBlockSchema = z.object({
  id: ElementId,
  kind: z.enum(DESIGN_BLOCK_KINDS),
  title: Title,
  description: z.string().trim().max(DESIGN_TEXT_MAX_CHARS).optional()
})

export const DesignGroupSchema = z.object({
  id: ElementId,
  title: Title,
  blocks: z.array(DesignBlockSchema).max(DESIGN_CANVAS_MAX_BLOCKS_PER_GROUP),
  position: z.object({ x: z.number().finite(), y: z.number().finite() }).optional()
})

export const DesignEdgeSchema = z.object({
  id: ElementId,
  fromGroupId: ElementId,
  fromBlockId: ElementId.optional(),
  toGroupId: ElementId,
  label: z.string().trim().max(DESIGN_NAME_MAX_CHARS).optional()
})

export const DesignCanvasSchema = z
  .object({
    groups: z.array(DesignGroupSchema).min(1).max(DESIGN_CANVAS_MAX_GROUPS),
    edges: z.array(DesignEdgeSchema).max(DESIGN_CANVAS_MAX_EDGES),
    summary: z.string().trim().max(DESIGN_SUMMARY_MAX_CHARS).optional()
  })
  .superRefine((canvas, ctx) => {
    const groupIds = new Set<string>()
    const blockGroup = new Map<string, string>()
    for (const group of canvas.groups) {
      if (groupIds.has(group.id)) {
        ctx.addIssue({ code: 'custom', message: `Duplicate group id "${group.id}"` })
      }
      groupIds.add(group.id)
      for (const block of group.blocks) {
        if (blockGroup.has(block.id)) {
          ctx.addIssue({ code: 'custom', message: `Duplicate block id "${block.id}"` })
        }
        blockGroup.set(block.id, group.id)
      }
    }
    for (const edge of canvas.edges) {
      if (!groupIds.has(edge.fromGroupId) || !groupIds.has(edge.toGroupId)) {
        ctx.addIssue({ code: 'custom', message: `Edge "${edge.id}" points to an unknown group` })
      }
      if (edge.fromBlockId !== undefined && blockGroup.get(edge.fromBlockId) !== edge.fromGroupId) {
        ctx.addIssue({
          code: 'custom',
          message: `Edge "${edge.id}" starts at block "${edge.fromBlockId}", which is not in group "${edge.fromGroupId}"`
        })
      }
    }
  })

/** Called by the renderer before the agent launches, so the design is listed even if the agent never reports. */
export const DesignCreateParams = z.object({
  name: requiredString('Missing design name').pipe(z.string().trim().max(DESIGN_NAME_MAX_CHARS)),
  request: requiredString('Missing design request').pipe(
    z.string().trim().max(DESIGN_REQUEST_MAX_CHARS)
  ),
  agent: requiredString('Missing agent'),
  repoId: OptionalString
})

/** Agent side: `from` is the caller's terminal handle; binds the design to that pane and its worktree. */
export const DesignStartParams = z.object({
  from: requiredString('Missing agent terminal'),
  id: requiredString('Missing --id')
})

/**
 * Agent side: only the pane bound by `design.start` may write the canvas. The canvas is checked by
 * the handler, so its error can name every bad field path instead of only the first message.
 */
export const DesignCanvasSetParams = z.object({
  from: requiredString('Missing agent terminal'),
  id: requiredString('Missing --id'),
  canvas: z.unknown()
})

export const DesignShowParams = z.object({ id: requiredString('Missing --id') })

export const DesignListParams = z.object({}).optional().default({})

/** User side. `from` (an agent pane) is refused: the agent reports completion with `design.complete`. */
export const DesignSetStatusParams = z.object({
  id: requiredString('Missing --id'),
  status: z.enum(DESIGN_STATUSES),
  from: OptionalString
})

export const DesignCompletionFileSchema = z.object({
  summary: z.string().trim().min(1).max(DESIGN_COMPLETION_SUMMARY_MAX_CHARS)
})

/** Agent side, only while in-progress; parsed in the handler so refusals name the field path. */
export const DesignCompleteParams = z.object({
  from: requiredString('Missing agent terminal'),
  id: requiredString('Missing --id'),
  completion: z.unknown()
})

/** User side: accept the agent's completion and move the design to done. */
export const DesignConfirmDoneParams = z.object({ id: requiredString('Missing --id') })

/** User side: refuse the completion; the text becomes a design comment the agent receives. */
export const DesignDeclineDoneParams = z.object({
  id: requiredString('Missing --id'),
  text: requiredString('Missing what is left to do').pipe(
    z.string().trim().max(DESIGN_MESSAGE_MAX_CHARS)
  )
})

export const DesignRenameParams = z.object({
  id: requiredString('Missing --id'),
  name: requiredString('Missing design name').pipe(z.string().trim().max(DESIGN_NAME_MAX_CHARS))
})

export const DesignDecisionInputSchema = z.object({
  question: z.string().trim().min(1).max(DESIGN_TEXT_MAX_CHARS),
  header: z.string().trim().max(40).optional(),
  options: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(DESIGN_NAME_MAX_CHARS),
        description: z.string().trim().max(DESIGN_TEXT_MAX_CHARS).optional()
      })
    )
    .min(2)
    .max(DESIGN_DECISION_MAX_OPTIONS),
  multiSelect: z.boolean().optional(),
  blockId: ElementId.optional()
})

/** Agent side; `decisions` is parsed in the handler so refusals name the field path. */
export const DesignDecideParams = z.object({
  from: requiredString('Missing agent terminal'),
  id: requiredString('Missing --id'),
  decisions: z.unknown()
})

export const DesignDecisionsFileSchema = z.object({
  decisions: z.array(DesignDecisionInputSchema).min(1).max(DESIGN_DECISION_MAX_OPEN)
})

/** User side. A note is free text sent with the chosen options. */
export const DesignAnswerParams = z.object({
  id: requiredString('Missing --id'),
  decisionId: requiredString('Missing decision id'),
  selected: z.array(z.string().trim().min(1)).min(1),
  note: z.string().trim().max(DESIGN_MESSAGE_MAX_CHARS).optional()
})

/** User side: a question or adjustment request on a block, or on the whole design without blockId. */
export const DesignCommentParams = z.object({
  id: requiredString('Missing --id'),
  blockId: OptionalString,
  text: requiredString('Missing comment').pipe(z.string().trim().max(DESIGN_MESSAGE_MAX_CHARS))
})

/** Agent side: the pending inbox, expanded so the agent reads question, answer and block in one call. */
export const DesignInboxParams = z.object({
  from: requiredString('Missing agent terminal'),
  id: requiredString('Missing --id')
})

export const DesignAckParams = z.object({
  from: requiredString('Missing agent terminal'),
  id: requiredString('Missing --id'),
  items: z.array(z.string().trim().min(1)).min(1)
})

export const DesignReplyFileSchema = z.object({
  replyTo: z.string().trim().min(1).optional(),
  blockId: ElementId.optional(),
  text: z.string().trim().min(1).max(DESIGN_MESSAGE_MAX_CHARS)
})

export const DesignReplyParams = z.object({
  from: requiredString('Missing agent terminal'),
  id: requiredString('Missing --id'),
  reply: z.unknown()
})

/** User side: clear a blocked delivery and nudge the agent again now. */
export const DesignResendParams = z.object({ id: requiredString('Missing --id') })
