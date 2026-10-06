import { Hono } from 'hono'
import type { AuthedHandler } from './azure-devops-link-routes.js'
import type { AuthStore } from './store.js'
import { WORK_PRESENCE_HEARTBEAT_MS, WorkPresenceSnapshot, type WorkPresenceRegistry } from './work-presence-registry.js'

const PRESENCE_PATH = '/v1/desktop/work-presence'
const MACHINE_ID = /^[A-Za-z0-9_-]{1,64}$/

/** The running desktop app reports which agents are working; see docs/reference/work-view-presence.md. */
export function workPresenceRoutes(deps: { store: AuthStore; registry: WorkPresenceRegistry; authed: AuthedHandler }) {
  const { store, registry, authed } = deps
  const app = new Hono()

  app.put(
    PRESENCE_PATH,
    authed(async (c, user) => {
      let raw: unknown = null
      try {
        raw = await c.req.json()
      } catch {
        // Falls through to invalid_request.
      }
      const snapshot = WorkPresenceSnapshot.safeParse(raw)
      if (!snapshot.success) {
        return c.json({ error: 'invalid_request' }, 400)
      }
      // Membership comes from the corporate org tables; session claims only carry the personal org.
      const [organization] = store.organizations.listMemberships(user.id)
      if (!organization) {
        return c.json({ error: 'no_organization' }, 404)
      }
      registry.put(user.id, snapshot.data)
      return c.json({ organizationId: organization.id, heartbeatMs: WORK_PRESENCE_HEARTBEAT_MS })
    })
  )

  app.delete(
    PRESENCE_PATH,
    authed((c, user) => {
      const machineId = c.req.query('machineId') ?? ''
      if (!MACHINE_ID.test(machineId)) {
        return c.json({ error: 'invalid_request' }, 400)
      }
      registry.remove(user.id, machineId)
      return c.json({})
    })
  )

  return app
}
