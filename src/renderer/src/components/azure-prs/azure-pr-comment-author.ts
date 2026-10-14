import type {
  AzureDevOpsPullRequestComment,
  AzureDevOpsPullRequestReviewer
} from '../../../../shared/azure-devops-pull-request-board'

// Why: id is the criterion; group names differ between endpoints (`[TEAM FOUNDATION]\` prefix), so names never match.
export function isCommentFromReviewer(
  comment: AzureDevOpsPullRequestComment,
  reviewer: AzureDevOpsPullRequestReviewer
): boolean {
  if (reviewer.id && comment.authorId) {
    return comment.authorId === reviewer.id
  }
  if (reviewer.uniqueName && comment.authorEmail) {
    return comment.authorEmail.toLowerCase() === reviewer.uniqueName.toLowerCase()
  }
  return false
}
