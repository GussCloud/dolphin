import { readFileSync } from 'node:fs'
import type { Context, Hono } from 'hono'
import { z } from 'zod'
import type { PageMessage, SignedIn } from './console-layout.js'
import {
  OFFICE_ASSETS_PATH,
  OFFICE_PATH,
  OFFICE_SCRIPTS,
  TV_PATH,
  renderOfficePage,
  renderTvPage
} from './console-office-page.js'
import type { ConsoleEnv } from './console-routes.js'
import { CONSOLE_PATH } from './console-session.js'
import type { OrganizationRow } from './organization-store.js'
import type { AuthStore } from './store.js'
import type { WorkPresenceRegistry, WorkViewMember } from './work-presence-registry.js'
import { workViewStream, type WorkViewStreamTiming } from './work-view-stream.js'

const LinkLabel = z.string().trim().min(1).max(60)

const NOTICES = new Map([['link-revoked', 'Link de exibição revogado.']])

// Same relative path from src/ (tsx, vitest) and dist/ (production); the Dockerfile ships static/.
const OFFICE_ASSETS = new Map<string, string>(
  OFFICE_SCRIPTS.map((name) => [name, readFileSync(new URL(`../static/office/${name}`, import.meta.url), 'utf8')])
)

/** Work view ("Escritório dos agentes"): any member watches their org; the owner manages TV links. */
export function registerOfficeRoutes(
  app: Hono<ConsoleEnv>,
  deps: {
    store: AuthStore
    registry: WorkPresenceRegistry
    signedIn: (c: Context<ConsoleEnv>) => SignedIn | undefined
    toLogin: (c: Context<ConsoleEnv>) => Response
    streamTiming?: WorkViewStreamTiming
  }
): void {
  const { store, registry, signedIn, toLogin } = deps
  const orgs = store.organizations
  const links = store.officeDisplayLinks

  /** The org whose office a signed-in user watches: the one they own, else their first membership. */
  const viewerOrganization = (userId: string): OrganizationRow | undefined =>
    orgs.findOwnedOrganization(userId) ?? orgs.listMemberships(userId)[0]

  const isMember = (orgId: string, userId: string): boolean =>
    orgs.listMemberships(userId).some((org) => org.id === orgId)

  const members = (orgId: string): WorkViewMember[] =>
    orgs.listMembers(orgId).map((m) => ({
      userId: m.user_id,
      // Why no full e-mail: the view may sit on a shared wall display.
      name: m.nickname ?? m.display_name ?? m.email.split('@')[0] ?? m.email
    }))

  const stream = (c: Context, orgId: string, stillAllowed: () => boolean) =>
    workViewStream(c, {
      registry,
      view: () => registry.view(members(orgId)),
      stillAllowed,
      ...(deps.streamTiming ? { timing: deps.streamTiming } : {})
    })

  const render = (
    c: Context<ConsoleEnv>,
    auth: SignedIn,
    organization: OrganizationRow,
    extra: { createdPath?: string; message?: PageMessage } = {},
    status: 200 | 400 = 200
  ) => {
    const isOwner = orgs.findOwnedOrganization(auth.user.id)?.id === organization.id
    return c.html(
      renderOfficePage({
        ...auth,
        organization,
        isOwner,
        links: isOwner ? links.listActive(organization.id) : [],
        ...extra
      }),
      status
    )
  }

  app.get(OFFICE_PATH, (c) => {
    const auth = signedIn(c)
    const organization = auth ? viewerOrganization(auth.user.id) : undefined
    if (!auth || !organization) {
      return auth ? c.redirect(CONSOLE_PATH, 303) : toLogin(c)
    }
    const notice = NOTICES.get(c.req.query('notice') ?? '')
    return render(c, auth, organization, notice ? { message: { kind: 'notice', text: notice } } : {})
  })

  app.get(`${OFFICE_PATH}/stream`, (c) => {
    const auth = signedIn(c)
    const organization = auth ? viewerOrganization(auth.user.id) : undefined
    if (!auth || !organization) {
      return c.text('unauthorized', 401)
    }
    const userId = auth.user.id
    const token = c.var.session?.token_hash
    return stream(c, organization.id, () => {
      const session = token ? store.consoleSessions.findByHash(token, Date.now()) : undefined
      return Boolean(session) && isMember(organization.id, userId)
    })
  })

  app.post(`${OFFICE_PATH}/display-links`, (c) => {
    const auth = signedIn(c)
    const organization = auth ? orgs.findOwnedOrganization(auth.user.id) : undefined
    if (!auth || !organization) {
      return auth ? c.redirect(OFFICE_PATH, 303) : toLogin(c)
    }
    const label = LinkLabel.safeParse(c.var.form.label)
    if (!label.success) {
      return render(c, auth, organization, { message: { kind: 'error', text: 'Dê um nome ao link (até 60 caracteres).' } }, 400)
    }
    const token = links.create({ orgId: organization.id, label: label.data, createdBy: auth.user.id, now: Date.now() })
    // Rendered, not redirected: the token is shown exactly once and never travels in a URL we log.
    return render(c, auth, organization, { createdPath: `${TV_PATH}/${token}` })
  })

  app.post(`${OFFICE_PATH}/display-links/:id/revoke`, (c) => {
    const auth = signedIn(c)
    const organization = auth ? orgs.findOwnedOrganization(auth.user.id) : undefined
    if (!auth || !organization) {
      return auth ? c.redirect(OFFICE_PATH, 303) : toLogin(c)
    }
    links.revoke(organization.id, c.req.param('id'), Date.now())
    return c.redirect(`${OFFICE_PATH}?notice=link-revoked`, 303)
  })

  const tvOrganization = (token: string): OrganizationRow | undefined => {
    const orgId = links.findOrgIdByToken(token)
    return orgId ? orgs.findOrganization(orgId) : undefined
  }

  app.get(`${TV_PATH}/:token`, (c) => {
    const token = c.req.param('token')
    const organization = tvOrganization(token)
    if (!organization) {
      return c.text('Link de exibição inválido ou revogado.', 404)
    }
    c.header('referrer-policy', 'no-referrer')
    return c.html(renderTvPage({ organization, token }))
  })

  app.get(`${TV_PATH}/:token/stream`, (c) => {
    const token = c.req.param('token')
    const organization = tvOrganization(token)
    if (!organization) {
      return c.text('not found', 404)
    }
    return stream(c, organization.id, () => links.findOrgIdByToken(token) === organization.id)
  })

  app.get(`${OFFICE_ASSETS_PATH}/:name`, (c) => {
    const body = OFFICE_ASSETS.get(c.req.param('name'))
    if (body === undefined) {
      return c.text('not found', 404)
    }
    c.header('content-type', 'text/javascript; charset=utf-8')
    c.header('cache-control', 'public, max-age=300')
    return c.body(body)
  })
}
