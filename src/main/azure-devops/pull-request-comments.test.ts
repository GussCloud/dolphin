import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AzureDevOpsPullRequestComments } from '../../shared/rpc-contract/azure-devops-params'
import {
  getAzureDevOpsPullRequestComments,
  parsePullRequestComments,
  readPullRequestCommentsArgs
} from './pull-request-comments'

const mocks = vi.hoisted(() => ({ organizationUrl: vi.fn(), send: vi.fn() }))

vi.mock('../azure-boards/azure-boards-scope', () => ({
  getAzureBoardsOrganizationUrl: mocks.organizationUrl
}))
vi.mock('./azure-devops-mutation-request', () => ({ sendAzureDevOpsRequest: mocks.send }))

function comment(id: number, content: string, publishedDate: string, extra = {}): unknown {
  return {
    id,
    content,
    publishedDate,
    author: { id: 'u1', displayName: 'Ana', uniqueName: 'a@x' },
    ...extra
  }
}

describe('parsePullRequestComments', () => {
  it('orders newest first and puts unreadable dates last', () => {
    const result = parsePullRequestComments({
      value: [
        {
          id: 1,
          status: 'active',
          comments: [
            comment(1, 'old', '2026-01-01T10:00:00.5Z'),
            comment(2, 'bad', 'not-a-date'),
            comment(3, 'new', '2026-01-02T10:00:00.55Z'),
            comment(4, 'later fraction', '2026-01-01T10:00:00.55Z')
          ]
        }
      ]
    })
    expect(result.map((c) => c.content)).toEqual(['new', 'later fraction', 'old', 'bad'])
  })

  it('discards deleted threads, system, deleted and empty comments', () => {
    const result = parsePullRequestComments({
      value: [
        {
          id: 1,
          isDeleted: true,
          comments: [comment(1, 'in deleted thread', '2026-01-01T00:00:00Z')]
        },
        {
          id: 2,
          comments: [
            comment(1, 'system', '2026-01-01T00:00:00Z', { commentType: 'system' }),
            comment(2, 'gone', '2026-01-01T00:00:00Z', { isDeleted: true }),
            comment(3, '   ', '2026-01-01T00:00:00Z'),
            comment(4, '  kept  ', '2026-01-01T00:00:00Z', { parentCommentId: 1 })
          ]
        }
      ]
    })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 4,
      threadId: 2,
      content: 'kept',
      threadStatus: 'unknown',
      isReply: true,
      authorId: 'u1',
      filePath: null,
      line: null
    })
  })

  it('reads file and line from the right side, falling back to the left', () => {
    const [right, left] = parsePullRequestComments({
      value: [
        {
          id: 1,
          status: 'fixed',
          threadContext: {
            filePath: '/a/b.ts',
            rightFileStart: { line: 7 },
            leftFileStart: { line: 3 }
          },
          comments: [comment(1, 'r', '2026-01-02T00:00:00Z')]
        },
        {
          id: 2,
          threadContext: { filePath: '/c.ts', leftFileStart: { line: 3 } },
          comments: [comment(1, 'l', '2026-01-01T00:00:00Z')]
        }
      ]
    })
    expect(right).toMatchObject({ filePath: '/a/b.ts', line: 7, threadStatus: 'fixed' })
    expect(left).toMatchObject({ filePath: '/c.ts', line: 3 })
  })

  it('tolerates a malformed payload', () => {
    expect(parsePullRequestComments(null)).toEqual([])
    expect(parsePullRequestComments({ value: 'x' })).toEqual([])
  })
})

describe('comments params validation', () => {
  it('accepts a complete reference', () => {
    expect(
      readPullRequestCommentsArgs({ project: 'P', repositoryId: 'r', pullRequestId: 5 })
    ).toEqual({ project: 'P', repositoryId: 'r', pullRequestId: 5 })
  })

  it.each([
    null,
    {},
    { project: '', repositoryId: 'r', pullRequestId: 5 },
    { project: 'P', repositoryId: '', pullRequestId: 5 },
    { project: 'P', repositoryId: 'r', pullRequestId: 0 },
    { project: 'P', repositoryId: 'r', pullRequestId: -1 },
    { project: 'P', repositoryId: 'r', pullRequestId: 1.5 },
    { project: 'P', repositoryId: 'r', pullRequestId: '5' }
  ])('rejects %j in both the IPC reader and the RPC schema', (value) => {
    expect(readPullRequestCommentsArgs(value)).toBeNull()
    expect(AzureDevOpsPullRequestComments.safeParse(value).success).toBe(false)
  })
})

describe('getAzureDevOpsPullRequestComments', () => {
  beforeEach(() => {
    mocks.organizationUrl.mockReset().mockResolvedValue('https://dev.azure.com/acme')
    mocks.send.mockReset()
  })

  it('builds the threads URL from the configured organization', async () => {
    mocks.send.mockResolvedValue({ value: [] })
    const result = await getAzureDevOpsPullRequestComments({
      project: 'My Project',
      repositoryId: 'repo/1',
      pullRequestId: 9
    })
    expect(result).toEqual({ ok: true, comments: [] })
    expect(mocks.send).toHaveBeenCalledWith(
      'https://dev.azure.com/acme',
      '/My%20Project/_apis/git/repositories/repo%2F1/pullRequests/9/threads',
      { method: 'GET', apiVersion: '7.1' }
    )
  })

  it('returns an error without any request for invalid params', async () => {
    const result = await getAzureDevOpsPullRequestComments({ project: 'P' })
    expect(result.ok).toBe(false)
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('turns a failed request into an error result', async () => {
    mocks.send.mockRejectedValue(new Error('boom'))
    expect(
      await getAzureDevOpsPullRequestComments({ project: 'P', repositoryId: 'r', pullRequestId: 1 })
    ).toEqual({ ok: false, error: 'boom' })
  })
})
