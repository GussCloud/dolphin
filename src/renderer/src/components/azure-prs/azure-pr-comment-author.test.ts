import { describe, expect, it } from 'vitest'
import type {
  AzureDevOpsPullRequestComment,
  AzureDevOpsPullRequestReviewer
} from '../../../../shared/azure-devops-pull-request-board'
import { isCommentFromReviewer } from './azure-pr-comment-author'

const reviewer = (id: string, uniqueName: string): AzureDevOpsPullRequestReviewer => ({
  id,
  displayName: 'R',
  uniqueName,
  imageUrl: '',
  vote: 0,
  isRequired: false,
  isContainer: false
})
const comment = (authorId: string, authorEmail: string): AzureDevOpsPullRequestComment => ({
  id: 1,
  threadId: 1,
  authorId,
  authorName: 'A',
  authorEmail,
  content: 'x',
  published: '',
  threadStatus: 'active',
  filePath: null,
  line: null,
  isReply: false
})

describe('isCommentFromReviewer', () => {
  it('matches by id and never falls back to email when both ids exist', () => {
    expect(isCommentFromReviewer(comment('1', 'a@x'), reviewer('1', 'b@x'))).toBe(true)
    expect(isCommentFromReviewer(comment('2', 'a@x'), reviewer('1', 'a@x'))).toBe(false)
  })
  it('falls back to a case-insensitive email without ids', () => {
    expect(isCommentFromReviewer(comment('', 'A@X'), reviewer('1', 'a@x'))).toBe(true)
    expect(isCommentFromReviewer(comment('', ''), reviewer('', ''))).toBe(false)
  })
})
