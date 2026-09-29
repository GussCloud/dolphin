import type { ExecutionHostId } from '../../shared/execution-host'
import type {
  HostedReviewAction,
  HostedReviewActionResult,
  HostedReviewDetails
} from '../../shared/hosted-review-actions'
import { performAzureDevOpsPullRequestAction } from '../azure-devops/pull-request-actions'
import { fetchAzureDevOpsPullRequestDetails } from '../azure-devops/pull-request-details'
import { getAzureDevOpsRepoRef } from '../azure-devops/repository-ref'
import { hostedReviewSshConnectionId } from './hosted-review-execution-host'

type HostedReviewTarget = {
  repoPath: string
  executionHostId: ExecutionHostId
  // Open string: runtime RPC forwards whatever provider token the client sent.
  provider: string
  number: number
}

const UNSUPPORTED = 'Review actions are not available for this provider yet.'

async function azureRepo(target: HostedReviewTarget) {
  // REST calls run on this client; only the remote-URL read is routed to an SSH host.
  const repo = await getAzureDevOpsRepoRef(
    target.repoPath,
    hostedReviewSshConnectionId(target.executionHostId)
  )
  if (!repo) {
    throw new Error('This repository has no Azure DevOps origin remote.')
  }
  return repo
}

export async function getHostedReviewDetails(
  target: HostedReviewTarget
): Promise<HostedReviewDetails | null> {
  if (target.provider !== 'azure-devops') {
    return null
  }
  return fetchAzureDevOpsPullRequestDetails(await azureRepo(target), target.number)
}

export async function performHostedReviewAction(
  target: HostedReviewTarget,
  action: HostedReviewAction
): Promise<HostedReviewActionResult> {
  if (target.provider !== 'azure-devops') {
    return { ok: false, error: UNSUPPORTED }
  }
  try {
    return await performAzureDevOpsPullRequestAction(await azureRepo(target), target.number, action)
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
