import type {
  AzureDevOpsBoardPullRequest,
  AzureDevOpsBoardWorkItem
} from '../../../../shared/azure-devops-pull-request-board'
import { situationStyleOf } from './azure-pr-tones'

export const NO_WORK_ITEM_GROUP_KEY = '__no-work-item__'

export type AzurePullRequestGroup = {
  key: string
  // Null in the bucket of pull requests that cite no work item.
  workItemId: number | null
  // Null when the id exists but the details did not load.
  workItem: AzureDevOpsBoardWorkItem | null
  pullRequests: AzureDevOpsBoardPullRequest[]
}

export function azurePullRequestKey(
  pr: Pick<AzureDevOpsBoardPullRequest, 'project' | 'id'>
): string {
  // Why: the pull request id is only unique within its project.
  return `${pr.project}-${pr.id}`
}

// A PR tied to two work items appears in both groups on purpose: hiding it from either delivery would lose it.
export function groupByWorkItem(
  pullRequests: AzureDevOpsBoardPullRequest[],
  details: Record<string, AzureDevOpsBoardWorkItem>
): AzurePullRequestGroup[] {
  const byKey = new Map<string, AzurePullRequestGroup>()

  const push = (key: string, id: number | null, pr: AzureDevOpsBoardPullRequest): void => {
    let group = byKey.get(key)
    if (!group) {
      group = {
        key,
        workItemId: id,
        workItem: id === null ? null : (details[String(id)] ?? null),
        pullRequests: []
      }
      byKey.set(key, group)
    }
    group.pullRequests.push(pr)
  }

  for (const pr of pullRequests) {
    if (pr.workItemIds.length === 0) {
      push(NO_WORK_ITEM_GROUP_KEY, null, pr)
    } else {
      for (const id of pr.workItemIds) {
        push(`wi-${id}`, id, pr)
      }
    }
  }

  // Cards inside a group keep the host's order; groups sort by their most urgent card.
  const urgency = (g: AzurePullRequestGroup): number =>
    Math.min(...g.pullRequests.map((p) => situationStyleOf(p.situation).order))
  const oldest = (g: AzurePullRequestGroup): number =>
    Math.max(...g.pullRequests.map((p) => p.ageDays))

  return [...byKey.values()].sort((a, b) => {
    // The no-item bucket goes last: at the top it would bury real work under a process problem.
    if ((a.key === NO_WORK_ITEM_GROUP_KEY) !== (b.key === NO_WORK_ITEM_GROUP_KEY)) {
      return a.key === NO_WORK_ITEM_GROUP_KEY ? 1 : -1
    }
    return (
      urgency(a) - urgency(b) || oldest(b) - oldest(a) || (a.workItemId ?? 0) - (b.workItemId ?? 0)
    )
  })
}

// How many PRs the grouped list shows more than once.
export function multiItemCount(pullRequests: AzureDevOpsBoardPullRequest[]): number {
  return pullRequests.filter((p) => p.workItemIds.length > 1).length
}
