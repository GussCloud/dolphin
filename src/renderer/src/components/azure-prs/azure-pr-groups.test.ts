import { describe, expect, it } from 'vitest'
import type {
  AzureDevOpsBoardPullRequest,
  AzureDevOpsBoardWorkItem
} from '../../../../shared/azure-devops-pull-request-board'
import { NO_WORK_ITEM_GROUP_KEY, groupByWorkItem, multiItemCount } from './azure-pr-groups'
import { buildAzureReviewRequest } from './azure-pr-review-request'

function pr(overrides: Partial<AzureDevOpsBoardPullRequest>): AzureDevOpsBoardPullRequest {
  return {
    id: 1,
    title: 'Fix thing',
    project: 'P',
    repository: 'repo',
    repositoryId: 'r1',
    sourceBranch: 'feature/x',
    targetBranch: 'main',
    createdBy: 'Ana',
    createdByEmail: 'ana@example.com',
    creationDate: '2026-01-01T00:00:00Z',
    isDraft: false,
    mergeStatus: 'succeeded',
    url: 'https://dev.azure.com/org/P/_git/repo/pullrequest/1',
    reviewers: [],
    policies: [],
    activeThreads: 0,
    totalThreads: 0,
    workItemIds: [],
    isMine: true,
    isReviewer: false,
    situation: 'pending',
    signals: [],
    ageDays: 0,
    ...overrides
  }
}

const details: Record<string, AzureDevOpsBoardWorkItem> = {
  '10': { id: 10, title: 'Ten', workItemType: 'Bug', state: 'Active', project: 'P', url: 'u10' }
}

describe('groupByWorkItem', () => {
  it('lists a PR tied to two items in both groups', () => {
    const groups = groupByWorkItem([pr({ id: 1, workItemIds: [10, 11] })], details)
    expect(groups.map((g) => g.key)).toEqual(['wi-10', 'wi-11'])
    expect(groups[0].pullRequests).toHaveLength(1)
    expect(groups[1].pullRequests).toHaveLength(1)
    expect(groups[0].workItem?.title).toBe('Ten')
    expect(groups[1].workItem).toBeNull()
  })

  it('puts the no-item bucket last even when it holds the most urgent PR', () => {
    const groups = groupByWorkItem(
      [
        pr({ id: 1, workItemIds: [], situation: 'conflicts' }),
        pr({ id: 2, workItemIds: [10], situation: 'approved' })
      ],
      details
    )
    expect(groups.map((g) => g.key)).toEqual(['wi-10', NO_WORK_ITEM_GROUP_KEY])
  })

  it('orders groups by urgency, then oldest, then id', () => {
    const groups = groupByWorkItem(
      [
        pr({ id: 1, workItemIds: [30], situation: 'pending', ageDays: 1 }),
        pr({ id: 2, workItemIds: [20], situation: 'pending', ageDays: 5 }),
        pr({ id: 3, workItemIds: [40], situation: 'rejected', ageDays: 0 }),
        pr({ id: 4, workItemIds: [10], situation: 'pending', ageDays: 5 })
      ],
      {}
    )
    expect(groups.map((g) => g.workItemId)).toEqual([40, 10, 20, 30])
  })
})

describe('multiItemCount', () => {
  it('counts only PRs citing more than one item', () => {
    expect(multiItemCount([pr({ workItemIds: [1] }), pr({ workItemIds: [1, 2] }), pr({})])).toBe(1)
  })
})

describe('buildAzureReviewRequest', () => {
  it('returns an empty string without PRs', () => {
    expect(buildAzureReviewRequest([])).toBe('')
  })

  it('lists number, title, items, repository -> target and link per PR', () => {
    const text = buildAzureReviewRequest([
      pr({ id: 7, title: 'Add x', workItemIds: [10, 11], repository: 'api', targetBranch: 'dev' })
    ])
    expect(text).toContain('- !7 - Add x (#10, #11)')
    expect(text).toContain('  api -> dev')
    expect(text).toContain('  https://dev.azure.com/org/P/_git/repo/pullrequest/1')
  })
})
