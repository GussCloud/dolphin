import { describe, expect, it } from 'vitest'
import type {
  AzureDevOpsPullRequestPolicy,
  AzureDevOpsPullRequestReviewer
} from '../../shared/azure-devops-pull-request-board'
import {
  parsePolicies,
  parseThreads,
  parseWorkItemIds,
  pullRequestSeverity,
  readPullRequestSituation
} from './pull-request-situation'

function reviewer(vote: number, isContainer: boolean): AzureDevOpsPullRequestReviewer {
  return {
    id: `id-${vote}-${isContainer}`,
    displayName: 'R',
    uniqueName: 'r@evup.com.br',
    imageUrl: '',
    vote,
    isRequired: true,
    isContainer
  }
}

function read(
  reviewers: AzureDevOpsPullRequestReviewer[],
  policies: AzureDevOpsPullRequestPolicy[] = []
): ReturnType<typeof readPullRequestSituation> {
  return readPullRequestSituation({
    isDraft: false,
    mergeStatus: 'succeeded',
    reviewers,
    policies,
    activeThreads: 0
  })
}

describe('readPullRequestSituation', () => {
  it('keeps a person approval pending when a reviewer group exists, and says why', () => {
    const result = read([reviewer(10, false), reviewer(0, true)])
    expect(result.situation).toBe('pending')
    expect(result.signals).toContainEqual({
      kind: 'person-approvals-missing-group',
      count: 1
    })
  })

  it('approves when the group approves', () => {
    expect(read([reviewer(5, true), reviewer(0, false)]).situation).toBe('approved')
  })

  it('counts people when there is no reviewer group', () => {
    expect(read([reviewer(10, false)]).situation).toBe('approved')
  })

  it('stays pending when nobody voted', () => {
    expect(read([reviewer(0, true), reviewer(0, false)]).situation).toBe('pending')
    expect(read([]).situation).toBe('pending')
  })

  it('holds pending while a blocking policy is open even if the group approved', () => {
    const result = read(
      [reviewer(10, true)],
      [{ name: 'PR build', status: 'queued', isBlocking: true }]
    )
    expect(result.situation).toBe('pending')
    expect(result.signals).toContainEqual({ kind: 'validation-running' })
  })

  it('orders blockers and emits the empty signal', () => {
    const conflicted = readPullRequestSituation({
      isDraft: false,
      mergeStatus: 'conflicts',
      reviewers: [reviewer(-10, false)],
      policies: [{ name: 'Build', status: 'broken', isBlocking: true }],
      activeThreads: 2
    })
    expect(conflicted.situation).toBe('conflicts')
    expect(conflicted.signals.map((signal) => signal.kind)).toEqual([
      'conflicts',
      'rejected',
      'policy-failed',
      'unresolved-threads'
    ])
    expect(
      readPullRequestSituation({
        isDraft: true,
        mergeStatus: 'succeeded',
        reviewers: [],
        policies: [],
        activeThreads: 0
      })
    ).toEqual({ situation: 'draft', signals: [{ kind: 'nothing-pending' }] })
  })

  it('sorts severity from conflicts to draft', () => {
    expect(pullRequestSeverity('conflicts')).toBeLessThan(pullRequestSeverity('pending'))
    expect(pullRequestSeverity('approved')).toBeLessThan(pullRequestSeverity('draft'))
  })
})

describe('parsePolicies', () => {
  it('prefers the settings name, falls back to the type name then Policy', () => {
    expect(
      parsePolicies({
        value: [
          {
            status: 'approved',
            configuration: {
              isBlocking: true,
              type: { displayName: 'Build' },
              settings: { displayName: 'PR build' }
            }
          },
          {
            status: 'running',
            configuration: { type: { displayName: 'Build' }, settings: {} }
          },
          {}
        ]
      })
    ).toEqual([
      { name: 'PR build', status: 'approved', isBlocking: true },
      { name: 'Build', status: 'running', isBlocking: false },
      { name: 'Policy', status: 'unknown', isBlocking: false }
    ])
  })

  it('returns nothing for a failed payload', () => {
    expect(parsePolicies(null)).toEqual([])
  })
})

describe('parseThreads', () => {
  it('ignores deleted and system-only threads', () => {
    expect(
      parseThreads({
        value: [
          { status: 'active', comments: [{ commentType: 'text' }] },
          {
            status: 'pending',
            comments: [{ commentType: 'system' }, { commentType: 'text' }]
          },
          { status: 'fixed', comments: [{ commentType: 'text' }] },
          { status: 'active', comments: [{ commentType: 'system' }] },
          {
            status: 'active',
            isDeleted: true,
            comments: [{ commentType: 'text' }]
          },
          { status: 'active', comments: [] }
        ]
      })
    ).toEqual({ active: 2, total: 3 })
  })
})

describe('parseWorkItemIds', () => {
  it('parses the string ids Azure returns and skips junk', () => {
    expect(parseWorkItemIds({ value: [{ id: '12' }, { id: 'x' }, { id: 7 }, {}] })).toEqual([12])
  })
})
