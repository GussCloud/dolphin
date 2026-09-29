import { z } from 'zod'
import { requiredString } from './rpc-param-primitives'

const Vote = z.enum([
  'approved',
  'approved-with-suggestions',
  'no-vote',
  'waiting-for-author',
  'rejected'
])

export const HostedReviewActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('vote'), vote: Vote }),
  z.object({
    kind: z.literal('addReviewer'),
    identity: z.string().min(1),
    isRequired: z.boolean().optional()
  }),
  z.object({ kind: z.literal('removeReviewer'), reviewerId: z.string().min(1) }),
  z.object({
    kind: z.literal('complete'),
    mergeStrategy: z.enum(['merge', 'squash', 'rebase', 'rebase-merge']),
    deleteSourceBranch: z.boolean(),
    mergeCommitMessage: z.string().optional()
  }),
  z.object({ kind: z.literal('abandon') }),
  z.object({ kind: z.literal('reopen') }),
  z.object({ kind: z.literal('comment'), content: z.string().min(1) }),
  z.object({
    kind: z.literal('reply'),
    threadId: z.number().int().positive(),
    content: z.string().min(1),
    parentCommentId: z.number().int().positive().optional()
  }),
  z.object({
    kind: z.literal('setThreadStatus'),
    threadId: z.number().int().positive(),
    status: z.enum(['active', 'resolved'])
  }),
  z.object({
    kind: z.literal('edit'),
    title: z.string().optional(),
    description: z.string().optional()
  }),
  z.object({ kind: z.literal('setDraft'), isDraft: z.boolean() })
])

// Provider stays an open string: a newer client may name one this host does not implement,
// and the handler answers with a readable refusal instead of a params rejection.
export const HostedReviewDetailsParams = z.object({
  repo: requiredString('Missing repo selector'),
  provider: z.string(),
  number: z.number().int().positive()
})

export const HostedReviewSearchBranchesParams = z.object({
  repo: requiredString('Missing repo selector'),
  provider: z.string(),
  query: z.string().max(200)
})

export const HostedReviewActionParams = HostedReviewDetailsParams.extend({
  action: HostedReviewActionSchema
})
