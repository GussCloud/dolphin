import { useAppStore } from '@/store'
import { findWorktreeById } from '@/store/github/worktree-refresh'
import { branchName } from '@/lib/git-utils'
import { refreshHostedReviewCard } from '@/store/slices/hosted-review-card-refresh'
import type { AutonomousGoalListEntry } from '../../../../shared/autonomous-goal-types'

const SETTLED_TASK_STATUSES = new Set(['completed', 'failed'])

function workerStatuses(goals: AutonomousGoalListEntry[]): Map<string, string> {
  const statuses = new Map<string, string>()
  for (const goal of goals) {
    for (const worker of goal.progress?.workers ?? []) {
      statuses.set(worker.worktreeId, worker.taskStatus)
    }
  }
  return statuses
}

/** Worker worktrees whose Task settled between two snapshots; a first load reports none. */
export function newlySettledWorkerWorktreeIds(
  previous: AutonomousGoalListEntry[],
  next: AutonomousGoalListEntry[]
): string[] {
  const before = workerStatuses(previous)
  return [...workerStatuses(next)]
    .filter(([worktreeId, status]) => {
      const prior = before.get(worktreeId)
      return SETTLED_TASK_STATUSES.has(status) && prior !== undefined && prior !== status
    })
    .map(([worktreeId]) => worktreeId)
}

/** A settled worker just reported its PR, so its card should not wait for the 60 s review poll. */
export function refreshWorkerReviews(worktreeIds: string[]): void {
  const state = useAppStore.getState()
  for (const worktreeId of worktreeIds) {
    const worktree = findWorktreeById(state, worktreeId)
    const repo = worktree && state.repos.find((candidate) => candidate.id === worktree.repoId)
    if (!worktree || !repo || worktree.isBare || !worktree.branch) {
      continue
    }
    void refreshHostedReviewCard(state.fetchHostedReviewForBranch, {
      repoPath: repo.path,
      repoId: repo.id,
      branch: branchName(worktree.branch),
      linkedGitHubPR: worktree.linkedPR ?? null,
      linkedGitLabMR: worktree.linkedGitLabMR ?? null
    }).catch(() => {})
  }
}
