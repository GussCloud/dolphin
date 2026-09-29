// Provider-generic review detail and action contract. A provider fills in only the
// capabilities it supports; the UI renders controls from `capabilities`, never from
// provider names.

import type { HostedReviewProvider } from './hosted-review'

export type HostedReviewVote =
  | 'approved'
  | 'approved-with-suggestions'
  | 'no-vote'
  | 'waiting-for-author'
  | 'rejected'

export type HostedReviewReviewer = {
  id: string
  displayName: string
  uniqueName: string | null
  vote: HostedReviewVote
  isRequired: boolean
  isCurrentUser: boolean
}

export type HostedReviewThreadStatus = 'active' | 'resolved'

export type HostedReviewThreadComment = {
  id: number
  author: string
  content: string
  createdAt: string
}

export type HostedReviewThread = {
  id: number
  status: HostedReviewThreadStatus
  filePath: string | null
  line: number | null
  comments: HostedReviewThreadComment[]
}

export type HostedReviewMergeStrategy = 'merge' | 'squash' | 'rebase' | 'rebase-merge'

export type HostedReviewActionCapabilities = {
  vote: boolean
  editReviewers: boolean
  complete: boolean
  abandon: boolean
  reopen: boolean
  comment: boolean
  resolveThreads: boolean
  edit: boolean
  toggleDraft: boolean
  mergeStrategies: HostedReviewMergeStrategy[]
}

export type HostedReviewDetails = {
  provider: HostedReviewProvider
  number: number
  title: string
  description: string
  state: 'open' | 'closed' | 'merged' | 'draft'
  isDraft: boolean
  url: string
  author: string | null
  sourceBranch: string
  targetBranch: string
  createdAt: string | null
  hasConflicts: boolean
  reviewers: HostedReviewReviewer[]
  threads: HostedReviewThread[]
  capabilities: HostedReviewActionCapabilities
}

export type HostedReviewAction =
  | { kind: 'vote'; vote: HostedReviewVote }
  | { kind: 'addReviewer'; identity: string; isRequired?: boolean }
  | { kind: 'removeReviewer'; reviewerId: string }
  | {
      kind: 'complete'
      mergeStrategy: HostedReviewMergeStrategy
      deleteSourceBranch: boolean
      mergeCommitMessage?: string
    }
  | { kind: 'abandon' }
  | { kind: 'reopen' }
  | { kind: 'comment'; content: string }
  | { kind: 'reply'; threadId: number; content: string; parentCommentId?: number }
  | { kind: 'setThreadStatus'; threadId: number; status: HostedReviewThreadStatus }
  | { kind: 'edit'; title?: string; description?: string }
  | { kind: 'setDraft'; isDraft: boolean }

export type HostedReviewActionResult = { ok: true } | { ok: false; error: string }

export type HostedReviewDetailsArgs = {
  repoPath: string
  repoId?: string
  provider: HostedReviewProvider
  number: number
}

export type HostedReviewActionArgs = HostedReviewDetailsArgs & { action: HostedReviewAction }

export const NO_HOSTED_REVIEW_ACTIONS: HostedReviewActionCapabilities = {
  vote: false,
  editReviewers: false,
  complete: false,
  abandon: false,
  reopen: false,
  comment: false,
  resolveThreads: false,
  edit: false,
  toggleDraft: false,
  mergeStrategies: []
}

/** Providers whose host implements `hostedReview.details` / `hostedReview.action`. */
export function supportsHostedReviewDetails(provider: HostedReviewProvider): boolean {
  return provider === 'azure-devops'
}
