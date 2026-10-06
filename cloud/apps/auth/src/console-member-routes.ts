import type { Context, Hono } from 'hono'
import { z } from 'zod'
import type { PageMessage, SignedIn } from './console-layout.js'
import { renderMembersPage, type MemberFilterValues } from './console-members-page.js'
import type { ConsoleEnv } from './console-routes.js'
import { CONSOLE_PATH } from './console-session.js'
import type { MemberFilter } from './organization-store.js'
import type { AuthStore } from './store.js'

const MEMBERS_PATH = `${CONSOLE_PATH}/members`
const DAY_MS = 24 * 3600 * 1000

const Nickname = z.string().trim().max(100)

const NOTICES = new Map([
  ['member-renamed', 'Nome do membro salvo.'],
  ['member-removed', 'Membro removido da organização.']
])

// Dates are calendar days in Brazil (UTC-3 year-round since 2019), matching how joined_at is displayed.
function dayStart(value: string | undefined): number | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined
  }
  const ms = Date.parse(`${value}T00:00:00-03:00`)
  // Rejects impossible days such as 2026-02-31, which Date would roll into March.
  return Number.isFinite(ms) && new Date(ms + 3 * 3600 * 1000).toISOString().startsWith(value) ? ms : undefined
}

function readFilters(source: (key: string) => string | undefined): MemberFilterValues {
  const values: MemberFilterValues = {}
  const q = source('q')?.trim().slice(0, 100)
  const from = source('from')
  const to = source('to')
  if (q) {
    values.q = q
  }
  if (dayStart(from) !== undefined) {
    values.from = from
  }
  if (dayStart(to) !== undefined) {
    values.to = to
  }
  return values
}

function toMemberFilter(values: MemberFilterValues): MemberFilter {
  const to = dayStart(values.to)
  return {
    ...(values.q ? { search: values.q } : {}),
    ...(values.from ? { joinedFrom: dayStart(values.from) } : {}),
    ...(to === undefined ? {} : { joinedBefore: to + DAY_MS })
  }
}

function membersUrl(values: MemberFilterValues, notice?: string): string {
  const query = new URLSearchParams({ ...values, ...(notice ? { notice } : {}) }).toString()
  return query ? `${MEMBERS_PATH}?${query}` : MEMBERS_PATH
}

/** Owner-only member management: list with filters, org-scoped rename, and removal from the org. */
export function registerMemberRoutes(
  app: Hono<ConsoleEnv>,
  deps: {
    store: AuthStore
    signedIn: (c: Context<ConsoleEnv>) => SignedIn | undefined
    toLogin: (c: Context<ConsoleEnv>) => Response
  }
): void {
  const { store, signedIn, toLogin } = deps
  const orgs = store.organizations

  const ownerContext = (c: Context<ConsoleEnv>) => {
    const auth = signedIn(c)
    const organization = auth ? orgs.findOwnedOrganization(auth.user.id) : undefined
    return { auth, organization }
  }

  const render = (
    c: Context<ConsoleEnv>,
    auth: SignedIn,
    organizationId: string,
    filters: MemberFilterValues,
    msg?: PageMessage,
    status: 200 | 400 | 404 = 200
  ) => {
    const organization = orgs.findOrganization(organizationId)
    if (!organization) {
      return c.redirect(CONSOLE_PATH, 303)
    }
    const members = orgs.listMembers(organizationId, toMemberFilter(filters))
    const total = orgs.countMembers(organizationId)
    return c.html(
      renderMembersPage({ ...auth, organization, members, total, filters, ...(msg ? { message: msg } : {}) }),
      status
    )
  }

  app.get(MEMBERS_PATH, (c) => {
    const { auth, organization } = ownerContext(c)
    if (!auth || !organization) {
      return auth ? c.redirect(CONSOLE_PATH, 303) : toLogin(c)
    }
    const notice = NOTICES.get(c.req.query('notice') ?? '')
    const filters = readFilters((k) => c.req.query(k))
    return render(c, auth, organization.id, filters, notice ? { kind: 'notice', text: notice } : undefined)
  })

  app.post(`${MEMBERS_PATH}/:userId/name`, (c) => {
    const { auth, organization } = ownerContext(c)
    if (!auth || !organization) {
      return auth ? c.redirect(CONSOLE_PATH, 303) : toLogin(c)
    }
    const filters = readFilters((k) => c.var.form[k])
    const nickname = Nickname.safeParse(c.var.form.nickname ?? '')
    if (!nickname.success) {
      return render(c, auth, organization.id, filters, { kind: 'error', text: 'Use um nome de até 100 caracteres.' }, 400)
    }
    if (!orgs.setMemberNickname(organization.id, c.req.param('userId'), nickname.data || null)) {
      return render(c, auth, organization.id, filters, { kind: 'error', text: 'Membro não encontrado.' }, 404)
    }
    return c.redirect(membersUrl(filters, 'member-renamed'), 303)
  })

  app.post(`${MEMBERS_PATH}/:userId/delete`, (c) => {
    const { auth, organization } = ownerContext(c)
    if (!auth || !organization) {
      return auth ? c.redirect(CONSOLE_PATH, 303) : toLogin(c)
    }
    const filters = readFilters((k) => c.var.form[k])
    const outcome = orgs.removeMember(organization.id, c.req.param('userId'))
    if (outcome === 'owner') {
      return render(c, auth, organization.id, filters, { kind: 'error', text: 'O proprietário não pode ser removido.' }, 400)
    }
    if (outcome === 'not-found') {
      return render(c, auth, organization.id, filters, { kind: 'error', text: 'Membro não encontrado.' }, 404)
    }
    return c.redirect(membersUrl(filters, 'member-removed'), 303)
  })
}
