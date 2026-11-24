import { hasAzureDevOpsHttpsUrl } from '../../shared/git-scoped-credential-helper'
import { getAzureDevOpsAuthPreference } from './azure-devops-auth-preference-store'

/**
 * "Default sign-in": no managed Azure DevOps account, a remote that may be Azure DevOps https,
 * and Azure DevOps auth set to the Azure CLI, so git may use the global `az` login.
 */
export function usesDefaultAzureCliGitSignIn(input: {
  azureDevOpsAccountId?: string
  remoteUrl?: string
}): boolean {
  if (input.azureDevOpsAccountId) {
    return false
  }
  // Why only a known non-Azure remote skips: a repo's recorded identity can be missing or stale.
  if (input.remoteUrl && !hasAzureDevOpsHttpsUrl([input.remoteUrl])) {
    return false
  }
  return getAzureDevOpsAuthPreference().method === 'azure-cli'
}
