import type {
  AzureDevOpsAuthMethod,
  AzureDevOpsAuthPreference,
  AzureDevOpsConfigureDefaultsResult,
  AzureDevOpsRepositoriesResult
} from '../../../shared/azure-devops-auth'
import type {
  AzureDevOpsOrgLinkArgs,
  AzureDevOpsOrgLinkStatus
} from '../../../shared/azure-devops-org-link'
import type {
  AzureDevOpsPullRequestBoardResult,
  AzureDevOpsPullRequestCommentsArgs,
  AzureDevOpsPullRequestCommentsResult,
  AzureDevOpsReviewerAvatarResult
} from '../../../shared/azure-devops-pull-request-board'
import type { GlobalSettings } from '../../../shared/global-settings-types'
import { callRuntimeRpc, getActiveRuntimeTarget } from '@/runtime/runtime-rpc-client'

type RuntimeSettings = Pick<GlobalSettings, 'activeRuntimeEnvironmentId'> | null | undefined

// Why: Azure DevOps auth belongs to the host that runs the forge code — the remote
// server when one is active (same scope rule as gh/glab), otherwise this desktop.
function desktopApi(): NonNullable<typeof window.api.azureDevOps> {
  const api = window.api?.azureDevOps
  if (!api) {
    throw new Error('Azure DevOps settings are not available in this client.')
  }
  return api
}

export function setAzureDevOpsAuthMethod(
  settings: RuntimeSettings,
  method: AzureDevOpsAuthMethod
): Promise<AzureDevOpsAuthPreference> {
  const target = getActiveRuntimeTarget(settings)
  return target.kind === 'environment'
    ? callRuntimeRpc<AzureDevOpsAuthPreference>(target, 'azureDevOps.setAuthMethod', { method })
    : desktopApi().setAuthMethod(method)
}

export function configureAzureDevOpsCliDefaults(
  settings: RuntimeSettings,
  args: { organization: string; project: string | null }
): Promise<AzureDevOpsConfigureDefaultsResult> {
  const target = getActiveRuntimeTarget(settings)
  return target.kind === 'environment'
    ? callRuntimeRpc<AzureDevOpsConfigureDefaultsResult>(
        target,
        'azureDevOps.configureCliDefaults',
        args
      )
    : desktopApi().configureCliDefaults(args)
}

export function listAzureDevOpsRepositories(
  settings: RuntimeSettings
): Promise<AzureDevOpsRepositoriesResult> {
  const target = getActiveRuntimeTarget(settings)
  return target.kind === 'environment'
    ? callRuntimeRpc<AzureDevOpsRepositoriesResult>(target, 'azureDevOps.listRepositories')
    : desktopApi().listRepositories()
}

// Why: an older remote server or preload without the method must read as an error card, not a crash.
export async function getAzureDevOpsPullRequestBoard(
  settings: RuntimeSettings
): Promise<AzureDevOpsPullRequestBoardResult> {
  try {
    const target = getActiveRuntimeTarget(settings)
    return target.kind === 'environment'
      ? await callRuntimeRpc<AzureDevOpsPullRequestBoardResult>(
          target,
          'azureDevOps.pullRequestBoard'
        )
      : await desktopApi().pullRequestBoard()
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not load Azure DevOps pull requests.'
    }
  }
}

export async function getAzureDevOpsPullRequestComments(
  settings: RuntimeSettings,
  args: AzureDevOpsPullRequestCommentsArgs
): Promise<AzureDevOpsPullRequestCommentsResult> {
  try {
    const target = getActiveRuntimeTarget(settings)
    return target.kind === 'environment'
      ? await callRuntimeRpc<AzureDevOpsPullRequestCommentsResult>(
          target,
          'azureDevOps.pullRequestComments',
          args
        )
      : await desktopApi().pullRequestComments(args)
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not load the pull request comments.'
    }
  }
}

export async function getAzureDevOpsReviewerAvatar(
  settings: RuntimeSettings,
  url: string
): Promise<AzureDevOpsReviewerAvatarResult> {
  try {
    const target = getActiveRuntimeTarget(settings)
    return target.kind === 'environment'
      ? await callRuntimeRpc<AzureDevOpsReviewerAvatarResult>(
          target,
          'azureDevOps.reviewerAvatar',
          {
            url
          }
        )
      : await desktopApi().reviewerAvatar(url)
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not load the reviewer avatar.'
    }
  }
}

export function setAzureCliAutoRenew(
  settings: RuntimeSettings,
  enabled: boolean
): Promise<AzureDevOpsAuthPreference> {
  const target = getActiveRuntimeTarget(settings)
  return target.kind === 'environment'
    ? callRuntimeRpc<AzureDevOpsAuthPreference>(target, 'azureDevOps.setCliAutoRenew', { enabled })
    : desktopApi().setCliAutoRenew(enabled)
}

export function refreshAzureCliSession(settings: RuntimeSettings): Promise<void> {
  const target = getActiveRuntimeTarget(settings)
  return target.kind === 'environment'
    ? callRuntimeRpc<void>(target, 'azureDevOps.refreshCliSession')
    : desktopApi().refreshCliSession()
}

// Why: the link proves membership with this desktop's Dolphin session, which a remote
// host does not hold; asking the host would check someone else's session or none.
export async function getAzureDevOpsOrgLink(
  settings: RuntimeSettings,
  args: AzureDevOpsOrgLinkArgs = {}
): Promise<AzureDevOpsOrgLinkStatus> {
  const orgLink = window.api?.azureDevOps?.orgLink
  if (getActiveRuntimeTarget(settings).kind === 'environment' || !orgLink) {
    return { status: 'remote-host-unavailable' }
  }
  return orgLink(args)
}
