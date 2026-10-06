import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { z } from 'zod'
import { AZURE_DEVOPS_ONLY_PASSWORD } from './azure-devops-identity-store.js'
import {
  AzureDevOpsTokenRequest,
  joinOrganization,
  rejectionResponse,
  verifyRegisteredMember,
  type RegisteredMember
} from './azure-devops-org-membership.js'
import type { AzureDevOpsVerifier } from './azure-devops-verifier.js'
import type { AuthConfig } from './config.js'
import { issueSession } from './session-service.js'
import type { AuthStore, UserRow } from './store.js'

const SIGN_IN_PATH = '/v1/desktop/auth/azure-devops'

const SignInRequest = AzureDevOpsTokenRequest.extend({ localProfileId: z.string().max(256).optional() })

type Resolution =
  | { status: 'signed-in'; user: UserRow; accountCreated: boolean }
  | { status: 'account-exists' }
  | { status: 'invalid-credentials' }
  | { status: 'identity-race' }

/** Bind rules 1–3: a bound identity is that user; an unused email creates one; a taken email is never merged. */
function resolveUser(store: AuthStore, member: RegisteredMember, now: number): Resolution {
  const { proof } = member
  const boundUserId = store.azureDevOpsIdentities.findUserId(proof.azureDevOpsUserId)
  if (boundUserId) {
    const user = store.findUser(boundUserId)
    if (!user) {
      return { status: 'invalid-credentials' }
    }
    joinOrganization(store, member, user.id, now)
    return { status: 'signed-in', user, accountCreated: false }
  }
  // Why no account without an email: the user record is keyed by email and we never invent one.
  if (!proof.email) {
    return { status: 'invalid-credentials' }
  }
  if (store.findUserByEmail(proof.email)) {
    return { status: 'account-exists' }
  }
  const user: UserRow = {
    id: `usr_${randomUUID().replaceAll('-', '')}`,
    email: proof.email,
    password_hash: AZURE_DEVOPS_ONLY_PASSWORD,
    display_name: proof.displayName
  }
  store.createUser({
    id: user.id,
    email: user.email,
    passwordHash: user.password_hash,
    ...(user.display_name ? { displayName: user.display_name } : {})
  })
  const bound = store.azureDevOpsIdentities.bind({
    azureDevOpsUserId: proof.azureDevOpsUserId,
    userId: user.id,
    email: proof.email,
    now
  })
  if (bound.status !== 'bound') {
    return { status: 'identity-race' }
  }
  joinOrganization(store, member, user.id, now)
  return { status: 'signed-in', user, accountCreated: true }
}

class IdentityRace extends Error {}

/** Unauthenticated: the Azure DevOps token alone signs a member of a registered org into Dolphin. */
export function azureDevOpsSignInRoutes(deps: { store: AuthStore; config: AuthConfig; verifier: AzureDevOpsVerifier }) {
  const { store, config, verifier } = deps
  const app = new Hono()

  // Throwing rolls back a half-made account; the retry then finds the identity bound (rule 1).
  const resolveAtomically = (member: RegisteredMember): Exclude<Resolution, { status: 'identity-race' }> => {
    for (let attempt = 1; ; attempt++) {
      try {
        return store.transaction(() => {
          const resolution = resolveUser(store, member, Date.now())
          if (resolution.status === 'identity-race') {
            throw new IdentityRace()
          }
          return resolution
        })
      } catch (error) {
        if (!(error instanceof IdentityRace) || attempt === 2) {
          throw error
        }
      }
    }
  }

  app.post(SIGN_IN_PATH, async (c) => {
    let raw: unknown = null
    try {
      raw = await c.req.json()
    } catch {
      // Falls through to invalid_request.
    }
    const body = SignInRequest.safeParse(raw)
    if (!body.success) {
      return c.json({ error: 'invalid_request' }, 400)
    }
    const member = await verifyRegisteredMember(store, verifier, body.data)
    if (member.status !== 'registered-member') {
      return rejectionResponse(c, member)
    }
    const resolution = resolveAtomically(member)
    if (resolution.status !== 'signed-in') {
      return c.json({ status: resolution.status })
    }
    return c.json({
      status: 'signed-in',
      session: issueSession(store, config, resolution.user),
      organization: { id: member.organization.id, name: member.organization.name },
      azureDevOps: { organizationName: member.target.organizationName, instanceId: member.link.instance_id },
      accountCreated: resolution.accountCreated
    })
  })

  return app
}
