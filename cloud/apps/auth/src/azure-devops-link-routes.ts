import { Hono, type Context } from 'hono'
import { z } from 'zod'
import { parseAzureDevOpsOrganizationUrl, type AzureDevOpsVerifier } from './azure-devops-verifier.js'
import type { AzureDevOpsLinkRow, OrganizationRow } from './organization-store.js'
import type { AuthStore, UserRow } from './store.js'

export type AuthedHandler = (
  handler: (c: Context, user: UserRow, sessionId: string) => Promise<Response> | Response
) => (c: Context) => Promise<Response>

const LINK_PATH = '/v1/desktop/orgs/azure-devops/link'

const LinkRequest = z.object({
  organizationUrl: z.string().min(1).max(2048),
  azureDevOpsToken: z.string().min(1).max(8192),
  tokenKind: z.enum(['bearer', 'pat'])
})

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
      const body = LinkRequest.safeParse(raw)
      if (!body.success) {
        return c.json({ error: 'invalid_request' }, 400)
      }
      const target = parseAzureDevOpsOrganizationUrl(body.data.organizationUrl)
      if (!target) {
        return c.json({ status: 'unsupported-host' })
      }
      const proof = await verifier.verifyMember(target, body.data.azureDevOpsToken, body.data.tokenKind)
      if (proof.status === 'unavailable') {
        return c.json({ error: 'azure_devops_unavailable' }, 502)
      }
      if (proof.status !== 'verified') {
        // Optional field: older desktops ignore `reason`.
        const reason = proof.status === 'invalid-credentials' ? proof.reason : undefined
        return c.json({ status: 'invalid-credentials', ...(reason ? { reason } : {}) })
      }
      const link = orgs.findAzureDevOpsLinkByInstance(proof.instanceId)
      const organization = link ? orgs.findOrganization(link.org_id) : undefined
      if (!link || !organization) {
        return c.json({ status: 'not-registered' })
      }
      orgs.renameAzureDevOpsOrganization(link.instance_id, target.organizationName)
      orgs.recordAzureDevOpsMember({
        orgId: organization.id,
        userId: user.id,
        azureDevOpsUserId: proof.azureDevOpsUserId,
        now: Date.now()
      })
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
