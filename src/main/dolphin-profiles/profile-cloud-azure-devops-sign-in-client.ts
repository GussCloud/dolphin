import type { AzureDevOpsLinkCredentialsReason } from '../../shared/azure-devops-org-link'
import type { DolphinCloudAuthConfig } from './profile-cloud-auth-config'
import { DolphinCloudRequestError, normalizeSessionResponse } from './profile-cloud-client'
import { extractErrorCode } from './profile-cloud-org-members-client'
import type { DolphinCloudSessionExchangeResponse } from './profile-cloud-session-exchange'

const CLOUD_REQUEST_TIMEOUT_MS = 30_000

export type DolphinCloudAzureDevOpsSignInArgs = {
  organizationUrl: string
  azureDevOpsToken: string
  tokenKind: 'bearer' | 'pat'
  localProfileId: string
}

export type DolphinCloudAzureDevOpsSignInResponse =
  | {
      status: 'signed-in'
      session: DolphinCloudSessionExchangeResponse
      organizationName: string
      accountCreated: boolean
    }
  | { status: 'not-registered' }
  | { status: 'invalid-credentials'; reason?: AzureDevOpsLinkCredentialsReason }
  | { status: 'unsupported-host' }
  // A Dolphin account already owns the identity's email; the user must sign in once to link it.
  | { status: 'account-exists' }

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? Object.fromEntries(Object.entries(value)) : {}
}

function normalizeSignInResponse(value: unknown): DolphinCloudAzureDevOpsSignInResponse {
  const record = readRecord(value)
  const status = record.status
  switch (status) {
    case 'signed-in': {
      const organizationName = readRecord(record.organization).name
      if (typeof organizationName !== 'string' || !organizationName.trim()) {
        break
      }
      return {
        status,
        session: normalizeSessionResponse(record.session),
        organizationName: organizationName.trim(),
        accountCreated: record.accountCreated === true
      }
    }
    case 'not-registered':
    case 'unsupported-host':
    case 'account-exists':
      return { status }
    case 'invalid-credentials':
      // Why: unknown reasons from newer servers fall back to the generic message.
      return record.reason === 'public-org-scope' ? { status, reason: record.reason } : { status }
  }
  throw new Error('invalid_dolphin_azure_devops_sign_in_response')
}

// Unauthenticated: the Azure DevOps token is the credential. It goes only into this
// request body, and redirects are refused so it never reaches another origin.
export async function signInToDolphinCloudWithAzureDevOps(
  config: DolphinCloudAuthConfig,
  args: DolphinCloudAzureDevOpsSignInArgs
): Promise<DolphinCloudAzureDevOpsSignInResponse> {
  const response = await fetch(`${config.apiBaseUrl}/v1/desktop/auth/azure-devops`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(args),
    redirect: 'error',
    signal: AbortSignal.timeout(CLOUD_REQUEST_TIMEOUT_MS)
  })
  if (!response.ok) {
    throw new DolphinCloudRequestError(response.status, await extractErrorCode(response))
  }
  const body: unknown = await response.json()
  return normalizeSignInResponse(body)
}
