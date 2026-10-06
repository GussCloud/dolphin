import { Hono, type Context } from 'hono'
import {
  AzureDevOpsTokenRequest,
  joinOrganization,
  rejectionResponse,
  verifyRegisteredMember
} from './azure-devops-org-membership.js'
import { parseAzureDevOpsOrganizationUrl, type AzureDevOpsVerifier } from './azure-devops-verifier.js'
import type { AzureDevOpsLinkRow, OrganizationRow } from './organization-store.js'
import type { AuthStore, UserRow } from './store.js'

export type AuthedHandler = (
  handler: (c: Context, user: UserRow, sessionId: string) => Promise<Response> | Response
) => (c: Context) => Promise<Response>

const LINK_PATH = '/v1/desktop/orgs/azure-devops/link'

function connected(organization: OrganizationRow, link: AzureDevOpsLinkRow) {
  return {
    status: 'connected',
    organization: { id: organization.id, name: organization.name },
    azureDevOps: { organizationName: link.organization_name, instanceId: link.instance_id }
  } as const
}

/** Desktop proves AzDO membership with the user's own token; the server re-verifies it every time. */
export function azureDevOpsLinkRoutes(deps: { store: AuthStore; verifier: AzureDevOpsVerifier; authed: AuthedHandler }) {
  const { store, verifier, authed } = deps
  const orgs = store.organizations
  const app = new Hono()

  app.post(
    LINK_PATH,
    authed(async (c, user) => {
      let raw: unknown = null
      try {
        raw = await c.req.json()
      } catch {
        // Falls through to invalid_request.
      }
      const body = AzureDevOpsTokenRequest.safeParse(raw)
      if (!body.success) {
        return c.json({ error: 'invalid_request' }, 400)
      }
      const member = await verifyRegisteredMember(store, verifier, body.data)
      if (member.status !== 'registered-member') {
        return rejectionResponse(c, member)
      }
      store.transaction(() => joinOrganization(store, member, user.id, Date.now()))
      const { organization, link, target } = member
      return c.json(connected(organization, { ...link, organization_name: target.organizationName }))
    })
  )

  app.get(
    LINK_PATH,
    authed((c, user) => {
      const target = parseAzureDevOpsOrganizationUrl(c.req.query('organizationUrl') ?? '')
      if (!target) {
        return c.json({ error: 'invalid_request' }, 400)
      }
      const membership = orgs.findLinkedMembership(user.id, target.organizationName)
      return c.json(membership ? connected(membership.organization, membership.link) : { status: 'not-linked' })
    })
  )

  return app
}
