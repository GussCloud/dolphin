import type { Repo } from '../../../shared/repo-types'
import type { HostedReviewProvider } from '../../../shared/hosted-review'
import type {
  HostedReviewAction,
  HostedReviewActionResult,
  HostedReviewDetails
} from '../../../shared/hosted-review-actions'
import { getRepoExecutionHostId, parseExecutionHostId } from '../../../shared/execution-host'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'

type ReviewRef = { provider: HostedReviewProvider; number: number }

// Why: runtime-host projects live on the server, whose own forge code answers over RPC;
// local and SSH repos are served by this desktop's IPC.
function runtimeEnvironmentId(repo: Repo): string | null {
  const host = parseExecutionHostId(getRepoExecutionHostId(repo))
  return host?.kind === 'runtime' ? host.environmentId : null
}

export function fetchHostedReviewDetails(
  repo: Repo,
  review: ReviewRef
): Promise<HostedReviewDetails | null> {
  const environmentId = runtimeEnvironmentId(repo)
  if (environmentId) {
    return callRuntimeRpc<HostedReviewDetails | null>(
      { kind: 'environment', environmentId },
      'hostedReview.details',
      { repo: repo.id, provider: review.provider, number: review.number }
    )
  }
  return window.api.hostedReview.details({
    repoPath: repo.path,
    repoId: repo.id,
    provider: review.provider,
    number: review.number
  })
}

export function searchHostedReviewBranches(
  repo: Repo,
  provider: HostedReviewProvider,
  query: string
): Promise<string[]> {
  const environmentId = runtimeEnvironmentId(repo)
  if (environmentId) {
    return callRuntimeRpc<string[]>(
      { kind: 'environment', environmentId },
      'hostedReview.searchBranches',
      { repo: repo.id, provider, query }
    )
  }
  return window.api.hostedReview.searchBranches({
    repoPath: repo.path,
    repoId: repo.id,
    provider,
    query
  })
}

export function performHostedReviewAction(
  repo: Repo,
  review: ReviewRef,
  action: HostedReviewAction
): Promise<HostedReviewActionResult> {
  const environmentId = runtimeEnvironmentId(repo)
  if (environmentId) {
    return callRuntimeRpc<HostedReviewActionResult>(
      { kind: 'environment', environmentId },
      'hostedReview.action',
      { repo: repo.id, provider: review.provider, number: review.number, action }
    )
  }
  return window.api.hostedReview.action({
    repoPath: repo.path,
    repoId: repo.id,
    provider: review.provider,
    number: review.number,
    action
  })
}
