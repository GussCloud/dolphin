import type { DolphinCloudAuthConfig } from './profile-cloud-auth-config'
import {
  signInToDolphinCloudWithAzureDevOps,
  type DolphinCloudAzureDevOpsSignInArgs,
  type DolphinCloudAzureDevOpsSignInResponse
} from './profile-cloud-azure-devops-sign-in-client'
import { revokeDolphinCloudSession } from './profile-cloud-client'
import {
  beginCloudConnectAttempt,
  isBrowserCloudSignInPending,
  isCloudConnectAttemptSuperseded,
  markCloudConnectAttemptLinked
} from './profile-cloud-connect-attempts'
import { linkDolphinProfileToCloud } from './profile-cloud-index'
import {
  readDolphinCloudSession,
  saveDolphinCloudSessionExchange
} from './profile-cloud-session-store'
import { ensureActiveDolphinProfile } from './profile-index-store'

export type AzureDevOpsDolphinSignInResult =
  | Exclude<DolphinCloudAzureDevOpsSignInResponse, { status: 'signed-in' }>
  | { status: 'signed-in'; organizationName: string }
  // A browser sign-in, a sign-out, or a profile switch overtook this one; nothing was saved.
  | { status: 'superseded' }

/**
 * Signs the active profile in with an Azure DevOps token, completing exactly like the
 * browser sign-in: session store, cloud identity on the profile, and the sign-in event.
 */
export async function signInCurrentDolphinProfileWithAzureDevOps(
  config: DolphinCloudAuthConfig,
  userDataPath: string,
  args: Omit<DolphinCloudAzureDevOpsSignInArgs, 'localProfileId'>
): Promise<AzureDevOpsDolphinSignInResult> {
  const profileId = ensureActiveDolphinProfile(userDataPath).profile.id
  // Why: a sign-in the user started in the browser decides the account, not this one.
  if (isBrowserCloudSignInPending()) {
    return { status: 'superseded' }
  }
  const attempt = beginCloudConnectAttempt()
  const response = await signInToDolphinCloudWithAzureDevOps(config, {
    ...args,
    localProfileId: profileId
  })
  if (response.status !== 'signed-in') {
    return response
  }
  if (
    isCloudConnectAttemptSuperseded(attempt) ||
    isBrowserCloudSignInPending() ||
    ensureActiveDolphinProfile(userDataPath).profile.id !== profileId ||
    readDolphinCloudSession(profileId, userDataPath).status === 'found'
  ) {
    // Why: the server already issued this session; revoke it rather than orphan it.
    await revokeDolphinCloudSession(config, response.session).catch(() => undefined)
    return { status: 'superseded' }
  }
  saveDolphinCloudSessionExchange(profileId, userDataPath, response.session)
  linkDolphinProfileToCloud(profileId, response.session.cloud, userDataPath)
  markCloudConnectAttemptLinked(attempt)
  return { status: 'signed-in', organizationName: response.organizationName }
}
