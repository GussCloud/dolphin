// Reload guards for designs.json: a bad entry is dropped on its own and the design survives. Phase-1
// files have no decisions, messages, inbox or delivery, so those default to empty instead of failing.
import { z } from 'zod'
import {
  DesignCanvasSchema,
  DesignDecisionInputSchema
} from '../../shared/rpc-contract/design-params'
import {
  DESIGN_EVENT_KINDS,
  DESIGN_INBOX_KINDS,
  isDesignStatus,
  type Design,
  type DesignCanvasVersion,
  type DesignDelivery,
  type DesignEvent,
  type DesignInboxItem,
  type DesignMessage
} from '../../shared/design-types'
import { boundInbox } from './design-interaction'

const StoredDecisionSchema = DesignDecisionInputSchema.extend({
  id: z.string().min(1),
  multiSelect: z.boolean(),
  askedAt: z.number(),
  answer: z
    .object({ selected: z.array(z.string()), note: z.string().optional(), at: z.number() })
    .optional()
})

const StoredMessageSchema = z.object({
  id: z.string().min(1),
  author: z.enum(['user', 'agent']),
  text: z.string(),
  blockId: z.string().optional(),
  replyTo: z.string().optional(),
  at: z.number()
})

const StoredInboxItemSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(DESIGN_INBOX_KINDS),
    refId: z.string().min(1),
    canvasVersion: z.number().int().optional(),
    createdAt: z.number(),
    ackedAt: z.number().optional()
  })
  .refine((item) => item.kind !== 'status' || isDesignStatus(item.refId))

const StoredCompletionSchema = z.object({
  summary: z.string().min(1),
  at: z.number(),
  canvasVersion: z.number().int().nullable()
})

const StoredDeliverySchema = z.object({
  nudges: z.number().int().min(0),
  lastNudgeAt: z.number().optional(),
  blockedAt: z.number().optional()
})

/** Parses each entry on its own, keeping the valid ones. */
function validEntries<T>(value: unknown, parse: (entry: unknown) => T | null): T[] {
  if (!Array.isArray(value)) {
    return []
  }
  const kept: T[] = []
  for (const entry of value) {
    const parsed = parse(entry)
    if (parsed !== null) {
      kept.push(parsed)
    }
  }
  return kept
}

function parsedOrNull<T>(schema: z.ZodType<T>, value: unknown): T | null {
  const parsed = schema.safeParse(value)
  return parsed.success ? parsed.data : null
}

/** A design as phase 1 wrote it; the conversation fields are filled in by withValidHistory. */
export type StoredDesignCore = Omit<
  Design,
  'decisions' | 'messages' | 'inbox' | 'delivery' | 'completion'
> & {
  decisions?: unknown
  messages?: unknown
  inbox?: unknown
  delivery?: unknown
  completion?: unknown
}

export function withValidHistory(design: StoredDesignCore): Design {
  const decisions = validEntries(design.decisions, (entry) =>
    parsedOrNull(StoredDecisionSchema, entry)
  )
  const messages: DesignMessage[] = validEntries(design.messages, (entry) =>
    parsedOrNull(StoredMessageSchema, entry)
  )
  const inbox: DesignInboxItem[] = validEntries(design.inbox, (entry) =>
    parsedOrNull(StoredInboxItemSchema, entry)
  )
  const delivery: DesignDelivery = parsedOrNull(StoredDeliverySchema, design.delivery) ?? {
    nudges: 0
  }
  // Why the status check: a completion only exists while the design is being implemented.
  const completion =
    design.status === 'in-progress' ? parsedOrNull(StoredCompletionSchema, design.completion) : null
  const { completion: _stored, ...core } = design
  return {
    ...core,
    ...(completion ? { completion } : {}),
    canvasVersions: validEntries(design.canvasVersions, toStoredCanvasVersion),
    events: design.events.filter(isStoredEvent),
    decisions,
    messages,
    inbox: boundInbox(inbox, decisions, messages),
    delivery
  }
}

function toStoredCanvasVersion(value: unknown): DesignCanvasVersion | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('version' in value) ||
    typeof value.version !== 'number' ||
    !('at' in value) ||
    typeof value.at !== 'number' ||
    !('canvas' in value)
  ) {
    return null
  }
  const canvas = DesignCanvasSchema.safeParse(value.canvas)
  return canvas.success ? { version: value.version, at: value.at, canvas: canvas.data } : null
}

function isStoredEvent(value: unknown): value is DesignEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    DESIGN_EVENT_KINDS.some((kind) => kind === value.kind) &&
    'actor' in value &&
    (value.actor === 'user' || value.actor === 'agent' || value.actor === 'dolphin') &&
    'at' in value &&
    typeof value.at === 'number' &&
    (!('detail' in value) || typeof value.detail === 'string')
  )
}

function isNullableString(value: unknown): boolean {
  return value === null || typeof value === 'string'
}

export function isStoredDesign(value: unknown): value is StoredDesignCore {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'name' in value &&
    typeof value.name === 'string' &&
    'request' in value &&
    typeof value.request === 'string' &&
    'status' in value &&
    isDesignStatus(value.status) &&
    'agent' in value &&
    typeof value.agent === 'string' &&
    'repoId' in value &&
    isNullableString(value.repoId) &&
    'worktreeId' in value &&
    isNullableString(value.worktreeId) &&
    'paneKey' in value &&
    isNullableString(value.paneKey) &&
    'canvasVersions' in value &&
    Array.isArray(value.canvasVersions) &&
    'events' in value &&
    Array.isArray(value.events) &&
    'createdAt' in value &&
    typeof value.createdAt === 'number' &&
    'updatedAt' in value &&
    typeof value.updatedAt === 'number'
  )
}
