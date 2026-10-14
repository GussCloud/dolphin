import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  _resetAzureDevOpsPullRequestBoardState,
  getAzureDevOpsPullRequestBoard
} from './pull-request-board'

const mocks = vi.hoisted(() => ({
  organizationUrl: vi.fn(),
  send: vi.fn(),
  requestJson: vi.fn(),
  workItems: vi.fn()
}))

vi.mock('../azure-boards/azure-boards-scope', () => ({
  getAzureBoardsOrganizationUrl: mocks.organizationUrl
}))
vi.mock('./azure-devops-mutation-request', () => ({
  sendAzureDevOpsRequest: mocks.send
}))
vi.mock('./azure-devops-api-request', () => ({
  requestAzureDevOpsJsonAtBase: mocks.requestJson
}))
vi.mock('../azure-boards/work-items-client', () => ({
  fetchAzureBoardWorkItemsByIds: mocks.workItems
}))

const ORG = 'https://dev.azure.com/acme'

function rawPr(
  id: number,
  createdBy: string,
  reviewerIds: string[] = [],
  creationDate = new Date().toISOString(),
  isDraft = false
): unknown {
  return {
    pullRequestId: id,
    title: `PR ${id}`,
    isDraft,
    mergeStatus: 'succeeded',
    creationDate,
    sourceRefName: 'refs/heads/feature',
    targetRefName: 'refs/heads/main',
    createdBy: {
      id: createdBy,
      displayName: createdBy,
      uniqueName: `${createdBy}@acme.com`
    },
    repository: {
      id: `repo-${id}`,
      name: 'Web App',
      project: { id: 'proj-id', name: 'My Project' }
    },
    reviewers: reviewerIds.map((rid) => ({
      id: rid,
      vote: 0,
      isContainer: false
    }))
  }
}

function stubApi(prs: unknown[]): void {
  mocks.send.mockImplementation(async (_base: string, path: string) =>
    path === '/_apis/connectionData'
      ? {
          authenticatedUser: {
            id: 'me',
            providerDisplayName: 'Me',
            properties: { Account: { $value: 'me@acme.com' } }
          }
        }
      : { value: prs }
  )
  mocks.requestJson.mockImplementation(async (_base: string, path: string) =>
    path.endsWith('/workitems') ? { value: [{ id: '30' }, { id: '10' }] } : { value: [] }
  )
  mocks.workItems.mockResolvedValue(new Map())
}

describe('getAzureDevOpsPullRequestBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _resetAzureDevOpsPullRequestBoardState()
    mocks.organizationUrl.mockResolvedValue(ORG)
  })

  it('asks for an organization when none is configured', async () => {
    mocks.organizationUrl.mockResolvedValue(null)
    expect(await getAzureDevOpsPullRequestBoard()).toEqual({
      ok: false,
      error:
        'Set a default Azure DevOps organization in Settings > Integrations to see pull requests.'
    })
  })

  it('keeps only pull requests the user authored or reviews, and builds their fields', async () => {
    stubApi([rawPr(1, 'me'), rawPr(2, 'other', ['me']), rawPr(3, 'other', ['someone'])])
    const result = await getAzureDevOpsPullRequestBoard()
    if (!result.ok) {
      throw new Error(result.error)
    }
    expect(result.board.identity).toEqual({
      id: 'me',
      displayName: 'Me',
      email: 'me@acme.com'
    })
    const prs = result.board.pullRequests
    expect(prs.map((pr) => pr.id).sort()).toEqual([1, 2])
    const mine = prs.find((pr) => pr.id === 1)
    expect(mine).toMatchObject({
      isMine: true,
      isReviewer: false,
      sourceBranch: 'feature',
      targetBranch: 'main',
      workItemIds: [30, 10],
      url: `${ORG}/My%20Project/_git/Web%20App/pullrequest/1`
    })
    expect(prs.find((pr) => pr.id === 2)).toMatchObject({
      isMine: false,
      isReviewer: true
    })
    expect(mocks.workItems).toHaveBeenCalledWith(ORG, [10, 30])
  })

  it('sorts by severity then oldest first', async () => {
    const day = 86_400_000
    const draft = rawPr(1, 'me', [], undefined, true)
    stubApi([
      draft,
      rawPr(2, 'me', [], new Date(Date.now() - 1 * day).toISOString()),
      rawPr(3, 'me', [], new Date(Date.now() - 5 * day).toISOString())
    ])
    const result = await getAzureDevOpsPullRequestBoard()
    if (!result.ok) {
      throw new Error(result.error)
    }
    expect(result.board.pullRequests.map((pr) => pr.id)).toEqual([3, 2, 1])
    expect(result.board.pullRequests[0].ageDays).toBe(5)
  })

  it('keeps the pull request when a sub-call fails', async () => {
    stubApi([rawPr(1, 'me')])
    mocks.requestJson.mockResolvedValue(null)
    const result = await getAzureDevOpsPullRequestBoard()
    if (!result.ok) {
      throw new Error(result.error)
    }
    expect(result.board.pullRequests).toHaveLength(1)
    expect(result.board.pullRequests[0]).toMatchObject({
      policies: [],
      totalThreads: 0,
      workItemIds: []
    })
  })

  it('keeps the list when the work item lookup fails', async () => {
    stubApi([rawPr(1, 'me')])
    mocks.workItems.mockRejectedValue(new Error('boom'))
    const result = await getAzureDevOpsPullRequestBoard()
    expect(result.ok && result.board.pullRequests.length).toBe(1)
    expect(result.ok && result.board.workItems).toEqual({})
  })

  it('returns the Azure error message when listing fails', async () => {
    mocks.send.mockImplementation(async (_base: string, path: string) => {
      if (path === '/_apis/connectionData') {
        return { authenticatedUser: { id: 'me' } }
      }
      throw new Error('TF400813: not authorized')
    })
    expect(await getAzureDevOpsPullRequestBoard()).toEqual({
      ok: false,
      error: 'TF400813: not authorized'
    })
  })

  it('shares one in-flight load between concurrent callers', async () => {
    stubApi([rawPr(1, 'me')])
    const [first, second] = await Promise.all([
      getAzureDevOpsPullRequestBoard(),
      getAzureDevOpsPullRequestBoard()
    ])
    expect(first).toBe(second)
    expect(
      mocks.send.mock.calls.filter(([, path]) => path === '/_apis/git/pullrequests')
    ).toHaveLength(1)
    await getAzureDevOpsPullRequestBoard()
    expect(
      mocks.send.mock.calls.filter(([, path]) => path === '/_apis/git/pullrequests')
    ).toHaveLength(2)
  })
})
