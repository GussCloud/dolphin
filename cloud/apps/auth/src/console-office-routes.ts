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
import { GITHUB_LOGIN } from './user-avatar-store.js'
import type { WorkPresenceRegistry, WorkViewMember } from './work-presence-registry.js'
import { workViewStream, type WorkViewStreamTiming } from './work-view-stream.js'

const LinkLabel = z.string().trim().min(1).max(60)

const NOTICES = new Map([
  ['link-revoked', 'Link de exibição revogado.'],
  ['avatar-saved', 'Foto do escritório atualizada.']
])

const AvatarChoice = z.discriminatedUnion('source', [
  z.object({ source: z.literal('initials') }),
  z.object({ source: z.literal('azure-devops') }),
  z.object({ source: z.literal('github'), githubLogin: z.string().trim().regex(GITHUB_LOGIN) })
])

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
    orgs.listMembers(orgId).map((m) => {
      const avatar = store.avatars.resolve(m.user_id)
      return {
        userId: m.user_id,
        // Why no full e-mail: the view may sit on a shared wall display.
        name: m.nickname ?? m.display_name ?? m.email.split('@')[0] ?? m.email,
        ...(avatar.kind === 'initials' ? {} : { avatarVersion: avatar.version })
      }
    })

  /** A member's picture for a viewer already allowed into `orgId`; anyone else gets 404, never another org's picture. */
  const avatarResponse = (c: Context, orgId: string, userId: string): Response => {
    if (!orgs.listMembers(orgId).some((m) => m.user_id === userId)) {
      return c.text('not found', 404)
    }
    const avatar = store.avatars.resolve(userId)
    c.header('cache-control', 'private, max-age=300')
    if (avatar.kind === 'github') {
      return c.redirect(`https://github.com/${encodeURIComponent(avatar.login)}.png?size=160`, 302)
    }
    if (avatar.kind === 'azure-devops') {
      c.header('content-type', avatar.type)
      c.header('x-content-type-options', 'nosniff')
      c.header('content-security-policy', "default-src 'none'")
      return c.body(new Uint8Array(avatar.image))
    }
    return c.text('not found', 404)
  }

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
        avatar: store.avatars.settings(auth.user.id),
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

  app.get(`${OFFICE_PATH}/avatars/:userId`, (c) => {
    const auth = signedIn(c)
    const organization = auth ? viewerOrganization(auth.user.id) : undefined
    if (!auth || !organization) {
      return c.text('unauthorized', 401)
    }
    return avatarResponse(c, organization.id, c.req.param('userId'))
  })

  app.post(`${OFFICE_PATH}/avatar`, (c) => {
    const auth = signedIn(c)
    const organization = auth ? viewerOrganization(auth.user.id) : undefined
    if (!auth || !organization) {
      return auth ? c.redirect(CONSOLE_PATH, 303) : toLogin(c)
    }
    const choice = AvatarChoice.safeParse(c.var.form)
    if (!choice.success) {
      const text = c.var.form.source === 'github' ? 'Informe um usuário do GitHub válido (letras, números e hífens).' : 'Escolha uma opção de foto.'
      return render(c, auth, organization, { message: { kind: 'error', text } }, 400)
    }
    if (choice.data.source === 'azure-devops' && !store.avatars.settings(auth.user.id).hasAzureDevOpsImage) {
      return render(c, auth, organization, { message: { kind: 'error', text: 'Ainda não há foto do Azure DevOps. Entre de novo no Dolphin com o Azure DevOps para buscá-la.' } }, 400)
    }
    const data = choice.data
    store.avatars.choose(auth.user.id, data.source === 'github' ? { source: 'github', login: data.githubLogin } : data, Date.now())
    // Why: the view only changes on a presence update, so nudge open streams to resend the new picture version.
    registry.touch()
    return c.redirect(`${OFFICE_PATH}?notice=avatar-saved`, 303)
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

  app.get(`${TV_PATH}/:token/avatars/:userId`, (c) => {
    const organization = tvOrganization(c.req.param('token'))
    if (!organization) {
      return c.text('not found', 404)
    }
    return avatarResponse(c, organization.id, c.req.param('userId'))
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
    const name = c.req.param('name')
    const body = OFFICE_ASSETS.get(name)
    if (body === undefined) {
      return c.text('not found', 404)
    }
    c.header('content-type', 'text/javascript; charset=utf-8')
    c.header('cache-control', 'public, max-age=300')
    c.header('x-content-type-options', 'nosniff')
    return c.body(body)
  })
}
