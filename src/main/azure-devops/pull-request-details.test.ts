import { describe, expect, it } from 'vitest'
import {
  azureDevOpsCollectionBaseUrl,
  azureDevOpsVoteValue,
  mapAzureDevOpsPullRequestDetails,
  mapAzureDevOpsThreads,
  mapAzureDevOpsVote
} from './pull-request-details'
import type { AzureDevOpsRepoRef } from './repository-ref'

const repo: AzureDevOpsRepoRef = {
  host: 'dev.azure.com',
  organization: 'acme',
  project: 'Project',
  repository: 'repo',
  apiBaseUrl: 'https://dev.azure.com/acme/Project',
  webBaseUrl: 'https://dev.azure.com/acme/Project/_git/repo'
}

describe('Azure DevOps votes', () => {
  it('round-trips every vote through the REST numbers', () => {
    for (const vote of [
      'approved',
      'approved-with-suggestions',
      'no-vote',
      'waiting-for-author',
      'rejected'
    ] as const) {
      expect(mapAzureDevOpsVote(azureDevOpsVoteValue(vote))).toBe(vote)
    }
    expect(azureDevOpsVoteValue('rejected')).toBe(-10)
    expect(mapAzureDevOpsVote(7)).toBe('no-vote')
  })
})

describe('azureDevOpsCollectionBaseUrl', () => {
  it('drops the project segment', () => {
    expect(azureDevOpsCollectionBaseUrl(repo)).toBe('https://dev.azure.com/acme')
  })
})

describe('mapAzureDevOpsThreads', () => {
  it('drops system and deleted content and maps resolution states', () => {
    expect(
      mapAzureDevOpsThreads([
        {
          id: 1,
          status: 'active',
          threadContext: { filePath: '/src/a.ts', rightFileStart: { line: 4 } },
          comments: [
            { id: 1, content: 'Why?', author: { displayName: 'Ann' }, publishedDate: 'd1' },
            { id: 2, content: 'gone', isDeleted: true }
          ]
        },
        {
          id: 2,
          status: 'fixed',
          comments: [{ id: 1, content: 'ok', author: { uniqueName: 'b@x' } }]
        },
        { id: 3, status: null, comments: [{ id: 1, content: 'voted', commentType: 'system' }] },
        { id: 4, status: 'active', isDeleted: true, comments: [{ id: 1, content: 'x' }] }
      ])
    ).toEqual([
      {
        id: 1,
        status: 'active',
        filePath: '/src/a.ts',
        line: 4,
        comments: [{ id: 1, author: 'Ann', content: 'Why?', createdAt: 'd1' }]
      },
      {
        id: 2,
        status: 'resolved',
        filePath: null,
        line: null,
        comments: [{ id: 1, author: 'b@x', content: 'ok', createdAt: '' }]
      }
    ])
  })
})

describe('mapAzureDevOpsPullRequestDetails', () => {
  const raw = {
    pullRequestId: 7,
    title: 'Add feature',
    description: 'Body',
    status: 'active',
    isDraft: false,
    sourceRefName: 'refs/heads/feature',
    targetRefName: 'refs/heads/main',
    mergeStatus: 'conflicts',
    createdBy: { displayName: 'Ann' },
    reviewers: [
      { id: 'me', displayName: 'Me', vote: 10, isRequired: true },
      { id: 'bob', displayName: 'Bob', uniqueName: 'bob@x', vote: -5 }
    ]
  }

  it('maps an active PR with the signed-in reviewer marked', () => {
    const details = mapAzureDevOpsPullRequestDetails(raw, [], 'me', repo.webBaseUrl)
    expect(details).toMatchObject({
      provider: 'azure-devops',
      number: 7,
      state: 'open',
      sourceBranch: 'feature',
      targetBranch: 'main',
      hasConflicts: true,
      author: 'Ann',
      url: 'https://dev.azure.com/acme/Project/_git/repo/pullrequest/7',
      reviewers: [
        { id: 'me', vote: 'approved', isRequired: true, isCurrentUser: true },
        { id: 'bob', vote: 'waiting-for-author', uniqueName: 'bob@x', isCurrentUser: false }
      ]
    })
    expect(details?.capabilities).toMatchObject({ vote: true, complete: true, reopen: false })
  })

  it('offers reopen only for abandoned PRs and hides vote without an identity', () => {
    const details = mapAzureDevOpsPullRequestDetails(
      { ...raw, status: 'abandoned' },
      [],
      null,
      repo.webBaseUrl
    )
    expect(details?.state).toBe('closed')
    expect(details?.capabilities).toMatchObject({
      vote: false,
      complete: false,
      abandon: false,
      reopen: true
    })
  })

  it('does not offer completion for drafts', () => {
    const details = mapAzureDevOpsPullRequestDetails(
      { ...raw, isDraft: true },
      [],
      'me',
      repo.webBaseUrl
    )
    expect(details?.capabilities.complete).toBe(false)
    expect(details?.capabilities.toggleDraft).toBe(true)
  })
})
