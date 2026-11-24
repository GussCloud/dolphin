import {
  AZURE_CLI_SIGN_IN_CANCELLED,
  type AzureCliSignInResult,
  type AzureDevOpsAuthMethod
} from '../../../../shared/azure-devops-auth'
import { isAzureDevOpsCloneMissingSignIn } from '../../../../shared/git-clone-azure-sign-in-failure'
import { extractIpcErrorMessage } from '@/lib/ipc-error'

/** The dialog's "Sign in with a code" retry for a local Azure DevOps clone whose sign-in failed. */
export type CloneAzureSignIn = {
  available: boolean
  isSigningIn: boolean
  error: string | null
  signIn: () => Promise<void>
}

/** Whether the clone dialog can offer this computer's Azure DevOps sign-in for the failed clone. */
export function canOfferCloneAzureSignIn(input: {
  cloneUrl: string
  cloneError: string | null
  isCloning: boolean
  runtimeEnvironmentId: string | null | undefined
  sshTargetId: string | null | undefined
  authMethod: AzureDevOpsAuthMethod | undefined
  /** The managed Azure DevOps account the clone uses, if one was chosen. */
  azureDevOpsAccountId: string | undefined
}): boolean {
  // Why local only: an SSH or runtime clone uses the az login of the host that ran it.
  if (input.runtimeEnvironmentId?.trim() || input.sshTargetId?.trim()) {
    return false
  }
  // Why: only "Default sign-in" under Azure CLI auth reads the az login this button renews.
  if (input.authMethod !== 'azure-cli' || input.azureDevOpsAccountId) {
    return false
  }
  return Boolean(
    input.cloneError &&
    !input.isCloning &&
    isAzureDevOpsCloneMissingSignIn(input.cloneUrl.trim(), input.cloneError)
  )
}

/**
 * Device-code sign-in to the user's own az session, then one clone retry. Returns the error to
 * show, or null when the clone was retried, the user cancelled, or the dialog moved on meanwhile.
 */
export async function signInToAzureAndRetryClone(deps: {
  startSignIn: () => Promise<AzureCliSignInResult>
  isStillCurrent: () => boolean
  retryClone: () => Promise<void>
}): Promise<string | null> {
  let result: AzureCliSignInResult
  try {
    result = await deps.startSignIn()
  } catch (error) {
    result = { ok: false, error: extractIpcErrorMessage(error, String(error)) }
  }
  if (!deps.isStillCurrent()) {
    return null
  }
  if (result.ok) {
    await deps.retryClone()
    return null
  }
  return result.error === AZURE_CLI_SIGN_IN_CANCELLED ? null : result.error
}
