import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HostedReviewAction } from '../../shared/hosted-review-actions'
import { performAzureDevOpsPullRequestAction } from './pull-request-actions'
import { parseIdentityMatches } from './identity-search'
import { _resetAzureDevOpsPreviewApiVersionCache } from './azure-devops-api-request'
import type { AzureDevOpsRepoRef } from './repository-ref'

vi.mock('./azure-devops-credential', () => ({
  resolveAzureDevOpsAuthHeaders: async () => ({ Authorization: 'Bearer t' })
}))

const repo: AzureDevOpsRepoRef = {
  host: 'dev.azure.com',
  organization: 'acme',
  project: 'Project',
  repository: 'repo',
  apiBaseUrl: 'https://dev.azure.com/acme/Project',
  webBaseUrl: 'https://dev.azure.com/acme/Project/_git/repo'
}

type Call = { method: string; url: URL; body: unknown }

const PR = '/acme/Project/_apis/git/repositories/repo/pullRequests/7'

function stubFetch(respond: (call: Call) => Response): Call[] {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const call = {
        method: init?.method ?? 'GET',
        url: new URL(String(input)),
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
      }
      calls.push(call)
      return respond(call)
    })
  )
  return calls
}

const ok = (body: unknown = {}): Response => Response.json(body)
const act = (action: HostedReviewAction) => performAzureDevOpsPullRequestAction(repo, 7, action)

describe('performAzureDevOpsPullRequestAction', () => {
  beforeEach(() => _resetAzureDevOpsPreviewApiVersionCache())
  afterEach(() => vi.unstubAllGlobals())

  it('votes as the signed-in user', async () => {
    const calls = stubFetch((call) =>
      call.url.pathname.endsWith('/connectionData')
        ? ok({ authenticatedUser: { id: 'me-id' } })
        : ok()
    )
    await expect(act({ kind: 'vote', vote: 'approved' })).resolves.toEqual({ ok: true })
    expect(calls[0]?.url.pathname).toBe('/acme/_apis/connectionData')
    expect(calls[1]).toMatchObject({ method: 'PUT', body: { vote: 10 } })
    expect(calls[1]?.url.pathname).toBe(`${PR}/reviewers/me-id`)
  })

  it('completes against the current source commit with the chosen strategy', async () => {
    const calls = stubFetch((call) =>
      call.method === 'GET' ? ok({ lastMergeSourceCommit: { commitId: 'abc' } }) : ok()
    )
    await expect(
      act({ kind: 'complete', mergeStrategy: 'squash', deleteSourceBranch: true })
    ).resolves.toEqual({ ok: true })
    expect(calls[1]).toMatchObject({
      method: 'PATCH',
      body: {
        status: 'completed',
        lastMergeSourceCommit: { commitId: 'abc' },
        completionOptions: { mergeStrategy: 'squash', deleteSourceBranch: true }
      }
    })
  })

  it('replies to a thread and resolves it with REST status numbers', async () => {
    const calls = stubFetch(() => new Response(null, { status: 204 }))
    await act({ kind: 'reply', threadId: 3, content: ' thanks ', parentCommentId: 1 })
    await act({ kind: 'setThreadStatus', threadId: 3, status: 'resolved' })
    expect(calls[0]?.url.pathname).toBe(`${PR}/threads/3/comments`)
    expect(calls[0]?.body).toEqual({ parentCommentId: 1, content: 'thanks', commentType: 1 })
    expect(calls[1]).toMatchObject({ method: 'PATCH', body: { status: 2 } })
  })

  it('adds a reviewer resolved through the vssps identity search', async () => {
    const calls = stubFetch((call) =>
      call.url.hostname === 'vssps.dev.azure.com'
        ? ok({
            value: [
              {
                id: 'bob-id',
                providerDisplayName: 'Bob',
                properties: { Mail: { $value: 'bob@x.com' } }
              }
            ]
          })
        : ok()
    )
    await expect(act({ kind: 'addReviewer', identity: 'BOB@x.com' })).resolves.toEqual({ ok: true })
    expect(calls[0]?.url.searchParams.get('filterValue')).toBe('BOB@x.com')
    expect(calls[1]?.url.pathname).toBe(`${PR}/reviewers/bob-id`)
  })

  it('surfaces the Azure DevOps error message', async () => {
    stubFetch(() =>
      Response.json({ message: 'TF401027: You need Git Contribute' }, { status: 403 })
    )
    await expect(act({ kind: 'abandon' })).resolves.toEqual({
      ok: false,
      error: 'TF401027: You need Git Contribute'
    })
  })

  it('rejects empty comments before calling the API', async () => {
    const calls = stubFetch(() => ok())
    await expect(act({ kind: 'comment', content: '   ' })).resolves.toMatchObject({ ok: false })
    expect(calls).toHaveLength(0)
  })
})

describe('parseIdentityMatches', () => {
  it('ignores entries without an id', () => {
    expect(
      parseIdentityMatches({
        value: [
          { providerDisplayName: 'x' },
          { id: 'a', properties: { Account: { $value: 'a@x' } } }
        ]
      })
    ).toEqual([{ id: 'a', displayName: 'a', mail: null, account: 'a@x' }])
  })
})
