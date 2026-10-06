import type { Context } from 'hono'
import { z } from 'zod'
import {
  parseAzureDevOpsOrganizationUrl,
  type AzureDevOpsOrganizationRef,
  type AzureDevOpsProof,
  type AzureDevOpsVerifier
} from './azure-devops-verifier.js'
import type { AzureDevOpsLinkRow, OrganizationRow } from './organization-store.js'
import type { AuthStore } from './store.js'

export const AzureDevOpsTokenRequest = z.object({
  organizationUrl: z.string().min(1).max(2048),
  azureDevOpsToken: z.string().min(1).max(8192),
  tokenKind: z.enum(['bearer', 'pat'])
})

export type VerifiedProof = Extract<AzureDevOpsProof, { status: 'verified' }>

export type RegisteredMember = {
  status: 'registered-member'
  target: AzureDevOpsOrganizationRef
  proof: VerifiedProof
  link: AzureDevOpsLinkRow
  organization: OrganizationRow
}

type Rejection =
  | { status: 'unsupported-host' }
  | { status: 'invalid-credentials'; reason?: 'public-org-scope' }
  | { status: 'not-registered' }
  | { status: 'unavailable' }

/** The token proves membership of an AzDO org that a Dolphin org registered; the server re-verifies every time. */
export async function verifyRegisteredMember(
  store: AuthStore,
  verifier: AzureDevOpsVerifier,
  request: z.infer<typeof AzureDevOpsTokenRequest>
): Promise<RegisteredMember | Rejection> {
  const target = parseAzureDevOpsOrganizationUrl(request.organizationUrl)
  if (!target) {
    return { status: 'unsupported-host' }
  }
  const proof = await verifier.verifyMember(target, request.azureDevOpsToken, request.tokenKind)
  if (proof.status === 'unavailable') {
    return proof
  }
  if (proof.status !== 'verified') {
    const reason = proof.status === 'invalid-credentials' ? proof.reason : undefined
    return { status: 'invalid-credentials', ...(reason ? { reason } : {}) }
  }
  const link = store.organizations.findAzureDevOpsLinkByInstance(proof.instanceId)
  const organization = link ? store.organizations.findOrganization(link.org_id) : undefined
  if (!link || !organization) {
    return { status: 'not-registered' }
  }
  return { status: 'registered-member', target, proof, link, organization }
}

/** Same wire answers for link and sign-in; `reason` is optional so older desktops ignore it. */
export function rejectionResponse(c: Context, rejection: Rejection): Response {
  return rejection.status === 'unavailable'
    ? c.json({ error: 'azure_devops_unavailable' }, 502)
    : c.json(rejection)
}

/**
 * Upserts the membership (owners keep owner) and binds the identity to `userId` if it is still unbound.
 * Call inside `store.transaction`.
 */
export function joinOrganization(store: AuthStore, member: RegisteredMember, userId: string, now: number): void {
  const { proof, link, target } = member
  store.organizations.renameAzureDevOpsOrganization(link.instance_id, target.organizationName)
  store.organizations.recordAzureDevOpsMember({
    orgId: member.organization.id,
    userId,
    azureDevOpsUserId: proof.azureDevOpsUserId,
    now
  })
  // An identity bound to someone else stays theirs; this user still joins with the proof they hold.
  store.azureDevOpsIdentities.bind({ azureDevOpsUserId: proof.azureDevOpsUserId, userId, email: proof.email, now })
}
