import type { Worktree } from './workspace-list-sections'

// Why: matches desktop's PR_GROUP_META naming from worktree-list/rows/groups.ts.
// no PR/draft/unknown -> "In Progress", open -> "In Review", merged -> "Done", closed -> "Closed"
export type PRGroupKey = 'done' | 'in-review' | 'in-progress' | 'closed'

/** Catalog keys in the `worktree` namespace. */
export const PR_GROUP_LABEL_KEYS = {
  done: 'prGroupDone',
  'in-review': 'prGroupInReview',
  'in-progress': 'prGroupInProgress',
  closed: 'prGroupClosed'
} as const satisfies Record<PRGroupKey, string>

export const PR_GROUP_ORDER: PRGroupKey[] = ['done', 'in-review', 'in-progress', 'closed']

export function getPRGroupKey(w: Worktree): PRGroupKey {
  if (!w.linkedPR) {
    return 'in-progress'
  }
  const s = w.linkedPR.state.toLowerCase()
  if (s === 'merged') {
    return 'done'
  }
  if (s === 'closed') {
    return 'closed'
  }
  if (s === 'draft') {
    return 'in-progress'
  }
  return 'in-review'
}
