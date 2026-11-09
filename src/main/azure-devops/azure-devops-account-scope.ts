/**
 * Which Azure DevOps credential a repo-scoped request uses: the project's managed account
 * when it has one, otherwise the host's global credential (env token or the user's az login).
 * A project bound to an account that is gone or signed out fails closed — it never falls
 * back to the global credential, which may be a different person.
 */
import {
  azureDevOpsAccountConfigDir,
  findAzureDevOpsManagedAccount
} from './azure-devops-managed-accounts'
import { getAzureCliAccessTokenForConfigDir } from './azure-cli-access-token'

/** Present only for a project bound to a managed account; absent means the global credential. */
export type AzureDevOpsCredentialScope = { accountId: string }

export class AzureDevOpsAccountUnavailableError extends Error {
  readonly code = 'azure_devops_account_unavailable'
  constructor(message: string) {
    super(message)
    this.name = 'AzureDevOpsAccountUnavailableError'
  }
}

type RepoAccountLookup = (repoPath: string, connectionId?: string | null) => string | undefined

let repoAccountLookup: RepoAccountLookup | null = null

/** Registered once by the host that owns the repo store. */
export function setAzureDevOpsRepoAccountLookup(lookup: RepoAccountLookup | null): void {
  repoAccountLookup = lookup
}

export function resolveAzureDevOpsCredentialScopeForRepoPath(
  repoPath: string,
  connectionId?: string | null
): AzureDevOpsCredentialScope | undefined {
  const accountId = repoAccountLookup?.(repoPath, connectionId)
  return accountId ? { accountId } : undefined
}

/** Access token for a managed account; throws `AzureDevOpsAccountUnavailableError` with a user-facing reason. */
export async function resolveAzureDevOpsAccountToken(accountId: string): Promise<string> {
  const account = findAzureDevOpsManagedAccount(accountId)
  if (!account) {
    throw new AzureDevOpsAccountUnavailableError(
      "This project's Azure DevOps account was removed from Dolphin. Choose another account in the project settings."
    )
  }
  try {
    return await getAzureCliAccessTokenForConfigDir(azureDevOpsAccountConfigDir(account))
  } catch {
    const who = account.login || 'the project account'
    throw new AzureDevOpsAccountUnavailableError(
      `Azure DevOps account ${who} is signed out. Sign in again in Settings > Integrations.`
    )
  }
}
