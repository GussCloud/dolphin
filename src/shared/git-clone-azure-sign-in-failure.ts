import { hasAzureDevOpsHttpsUrl } from './git-scoped-credential-helper'

/** Where the failed clone ran, which decides how the user fixes the sign-in. */
export type AzureDevOpsCloneSignInHost = 'this-computer' | 'runtime-host' | 'ssh-host'

const AZURE_SIGN_IN_REJECTED = 'Azure DevOps did not accept the sign-in for this clone.'
const SIGN_IN_GUIDANCE: Record<AzureDevOpsCloneSignInHost, string> = {
  'this-computer': `${AZURE_SIGN_IN_REJECTED} Sign in to Azure DevOps and try again.`,
  // Why az login: a runtime clone reads the server's own az login, like a local one.
  'runtime-host': `${AZURE_SIGN_IN_REJECTED} The clone runs on the machine that will hold the repository, so sign in to Azure DevOps there (for example with az login) and try again.`,
  // Why no az login: SSH relay clones use only the host's own git credentials.
  'ssh-host': `${AZURE_SIGN_IN_REJECTED} The clone runs on the SSH host with that host's own git credentials, so configure a git credential helper or a personal access token for Azure DevOps there and try again.`
}

// Why these lines: what git prints under the non-interactive clone env when no helper had a credential.
const GIT_AUTH_FAILURE =
  /unable to get password from user|could not read (?:username|password)|authentication failed|terminal prompts disabled|returned error: 40[13]\b|\bHTTP(?:\/[\d.]+)? 40[13]\b/i
// Why 403 is left out: the account signed in but lacks access, which a new sign-in cannot fix.
const GIT_MISSING_SIGN_IN =
  /unable to get password from user|could not read (?:username|password)|authentication failed|terminal prompts disabled|returned error: 401\b|\bHTTP(?:\/[\d.]+)? 401\b/i

/** True when a clone of an Azure DevOps https URL failed because no sign-in was accepted. */
export function isAzureDevOpsCloneSignInFailure(cloneUrl: string, message: string): boolean {
  return (
    hasAzureDevOpsHttpsUrl([cloneUrl]) &&
    (message.includes(AZURE_SIGN_IN_REJECTED) || GIT_AUTH_FAILURE.test(message))
  )
}

/** True when signing in again can fix the failed clone: no credential was accepted at all. */
export function isAzureDevOpsCloneMissingSignIn(cloneUrl: string, message: string): boolean {
  // Why the git line only: a built message keeps it after "Git reported:".
  return hasAzureDevOpsHttpsUrl([cloneUrl]) && GIT_MISSING_SIGN_IN.test(message)
}

/** The message already built by a host that ran the clone, so a re-parse keeps it intact. */
export function findAzureDevOpsCloneSignInMessage(message: string): string | null {
  const index = message.indexOf(AZURE_SIGN_IN_REJECTED)
  return index === -1 ? null : message.slice(index)
}

export function formatAzureDevOpsCloneSignInMessage(
  gitLine: string,
  host: AzureDevOpsCloneSignInHost
): string {
  return `${SIGN_IN_GUIDANCE[host]} Git reported: ${gitLine}`
}
