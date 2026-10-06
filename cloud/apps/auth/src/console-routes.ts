import { randomUUID } from 'node:crypto'
import { Hono, type Context } from 'hono'
import { z } from 'zod'
import { parseAzureDevOpsOrganizationUrl, type AzureDevOpsVerifier } from './azure-devops-verifier.js'
import type { AuthConfig } from './config.js'
import {
  renderCreateOrganizationPage,
  renderLoginPage,
  renderOverviewPage,
  renderSignupPage,
  type PageMessage
} from './console-pages.js'
import { CONSOLE_PATH, consoleCookies, type ConsoleSessionRow } from './console-session.js'
import type { OrganizationRow } from './organization-store.js'
import { constantTimeEqual, hashPassword, verifyPassword } from './secrets.js'
import type { AuthStore, UserRow } from './store.js'

type ConsoleEnv = {
  Variables: {
    user: UserRow | undefined
    session: ConsoleSessionRow | undefined
    form: Record<string, string>
  }
}

const OrganizationName = z.string().trim().min(1).max(100)
const InviteCode = z.string().trim().min(1).max(200)

const SignupForm = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(1024),
  displayName: z.string().trim().min(1).max(100),
  organizationName: OrganizationName,
  inviteCode: InviteCode
})

const FIELD_ERRORS = {
  email: 'Informe um e-mail válido.',
  password: 'A senha precisa ter pelo menos 12 caracteres.',
  displayName: 'Informe seu nome (até 100 caracteres).',
  organizationName: 'Informe o nome da organização (até 100 caracteres).',
  inviteCode: 'Informe o código de convite.'
} as const
const FIELD_ERROR_BY_NAME = new Map<string, string>(Object.entries(FIELD_ERRORS))

const INVALID_INVITE = 'Código de convite inválido ou já utilizado.'

// Success notices come from a fixed list, so no query text is ever reflected into the page.
const NOTICES = new Map([
  ['created', 'Organização criada.'],
  ['renamed', 'Nome da organização salvo.'],
  ['connected', 'Azure DevOps conectado e verificado.']
])

function firstFieldError(error: z.ZodError): string {
  return FIELD_ERROR_BY_NAME.get(String(error.issues[0]?.path[0] ?? '')) ?? 'Dados inválidos.'
}

function newOrganizationId(): string {
  return `corg_${randomUUID().replaceAll('-', '')}`
}

/** Server-rendered admin console for corporate orgs, mounted under /console. */
export function consoleRoutes(deps: { store: AuthStore; config: AuthConfig; verifier: AzureDevOpsVerifier }) {
  const { store, config, verifier } = deps
  const orgs = store.organizations
  const cookies = consoleCookies(config.issuer.startsWith('https:'))
  const app = new Hono<ConsoleEnv>()
  const now = (): number => Date.now()

  app.use(`${CONSOLE_PATH}/*`, async (c, next) => {
    const token = cookies.readSession(c)
    const session = token ? store.consoleSessions.find(token, now()) : undefined
    const user = session ? store.findUser(session.user_id) : undefined
    c.set('session', user ? session : undefined)
    c.set('user', user)
    c.header('cache-control', 'no-store')
    c.header('x-frame-options', 'DENY')
    if (c.req.method !== 'POST') {
      return await next()
    }
    const body = await c.req.parseBody()
    const form = Object.fromEntries(
      Object.entries(body).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v]] : []))
    )
    const expected = user && session ? session.csrf_token : cookies.readPreSession(c)
    if (!expected || !form._csrf || !constantTimeEqual(expected, form._csrf)) {
      return c.text('Falha na verificação de segurança do formulário (CSRF). Recarregue a página.', 403)
    }
    c.set('form', form)
    return await next()
  })

  const signedIn = (c: Context<ConsoleEnv>): { user: UserRow; csrf: string } | undefined => {
    const user = c.var.user
    const session = c.var.session
    return user && session ? { user, csrf: session.csrf_token } : undefined
  }

  const toLogin = (c: Context<ConsoleEnv>) => c.redirect(`${CONSOLE_PATH}/login`, 303)

  const renderHome = (
    c: Context<ConsoleEnv>,
    auth: { user: UserRow; csrf: string },
    extra: { message?: PageMessage; organizationUrl?: string; organizationName?: string } = {},
    status: 200 | 400 | 409 | 502 = 200
  ) => {
    const organization = orgs.findOwnedOrganization(auth.user.id)
    if (!organization) {
      return c.html(
        renderCreateOrganizationPage({ ...auth, memberships: orgs.listMemberships(auth.user.id), ...extra }),
        status
      )
    }
    return c.html(renderOverviewPage({ ...auth, ...overviewData(organization), ...extra }), status)
  }

  const overviewData = (organization: OrganizationRow) => ({
    organization,
    link: orgs.findAzureDevOpsLink(organization.id),
    members: orgs.listMembers(organization.id),
    proof: config.azureDevOpsOrgProof
  })

  app.get(CONSOLE_PATH, (c) => {
    const auth = signedIn(c)
    if (!auth) {
      return toLogin(c)
    }
    const notice = NOTICES.get(c.req.query('notice') ?? '')
    return renderHome(c, auth, notice ? { message: { kind: 'notice', text: notice } } : {})
  })

  app.get(`${CONSOLE_PATH}/login`, (c) =>
    signedIn(c) ? c.redirect(CONSOLE_PATH, 303) : c.html(renderLoginPage({ csrf: cookies.ensurePreSession(c) }))
  )

  app.post(`${CONSOLE_PATH}/login`, async (c) => {
    const email = (c.var.form.email ?? '').trim()
    const user = store.findUserByEmail(email)
    if (!user || !(await verifyPassword(c.var.form.password ?? '', user.password_hash))) {
      const page = renderLoginPage({
        csrf: cookies.ensurePreSession(c),
        email,
        message: { kind: 'error', text: 'E-mail ou senha inválidos.' }
      })
      return c.html(page, 401)
    }
    cookies.writeSession(c, store.consoleSessions.create(user.id, now()))
    return c.redirect(CONSOLE_PATH, 303)
  })

  app.post(`${CONSOLE_PATH}/logout`, (c) => {
    const token = cookies.readSession(c)
    if (token) {
      store.consoleSessions.revoke(token)
    }
    cookies.clearSession(c)
    return toLogin(c)
  })

  app.get(`${CONSOLE_PATH}/signup`, (c) =>
    signedIn(c) ? c.redirect(CONSOLE_PATH, 303) : c.html(renderSignupPage({ csrf: cookies.ensurePreSession(c) }))
  )

  app.post(`${CONSOLE_PATH}/signup`, async (c) => {
    const form = c.var.form
    const values = { email: form.email, displayName: form.displayName, organizationName: form.organizationName }
    const fail = (text: string, status: 400 | 409) =>
      c.html(renderSignupPage({ csrf: cookies.ensurePreSession(c), values, message: { kind: 'error', text } }), status)
    const parsed = SignupForm.safeParse(form)
    if (!parsed.success) {
      return fail(firstFieldError(parsed.error), 400)
    }
    const input = parsed.data
    const passwordHash = await hashPassword(input.password)
    const userId = `usr_${randomUUID().replaceAll('-', '')}`
    const at = now()
    const outcome = store.transaction(() => {
      if (store.findUserByEmail(input.email)) {
        return 'email-taken'
      }
      if (!orgs.consumeInvite(input.inviteCode, userId, at)) {
        return 'invalid-invite'
      }
      store.createUser({ id: userId, email: input.email, passwordHash, displayName: input.displayName })
      orgs.createOrganization({ id: newOrganizationId(), name: input.organizationName, ownerId: userId, now: at })
      return 'created'
    })
    if (outcome === 'email-taken') {
      return fail('Já existe uma conta com este e-mail. Entre com ela para criar a organização.', 409)
    }
    if (outcome === 'invalid-invite') {
      return fail(INVALID_INVITE, 400)
    }
    cookies.writeSession(c, store.consoleSessions.create(userId, at))
    return c.redirect(`${CONSOLE_PATH}?notice=created`, 303)
  })

  app.post(`${CONSOLE_PATH}/organization`, (c) => {
    const auth = signedIn(c)
    if (!auth) {
      return toLogin(c)
    }
    const organizationName = c.var.form.organizationName
    const fail = (text: string) => renderHome(c, auth, { organizationName, message: { kind: 'error', text } }, 400)
    const name = OrganizationName.safeParse(organizationName)
    const invite = InviteCode.safeParse(c.var.form.inviteCode)
    if (!name.success || !invite.success) {
      return fail(name.success ? FIELD_ERRORS.inviteCode : FIELD_ERRORS.organizationName)
    }
    const at = now()
    const outcome = store.transaction(() => {
      // Why: one admin org per user for now; the unique owner index backs this check.
      if (orgs.findOwnedOrganization(auth.user.id)) {
        return 'already-owner'
      }
      if (!orgs.consumeInvite(invite.data, auth.user.id, at)) {
        return 'invalid-invite'
      }
      orgs.createOrganization({ id: newOrganizationId(), name: name.data, ownerId: auth.user.id, now: at })
      return 'created'
    })
    if (outcome === 'invalid-invite') {
      return fail(INVALID_INVITE)
    }
    return c.redirect(outcome === 'created' ? `${CONSOLE_PATH}?notice=created` : CONSOLE_PATH, 303)
  })

  app.post(`${CONSOLE_PATH}/organization/name`, (c) => {
    const auth = signedIn(c)
    const organization = auth ? orgs.findOwnedOrganization(auth.user.id) : undefined
    if (!auth || !organization) {
      return auth ? c.redirect(CONSOLE_PATH, 303) : toLogin(c)
    }
    const name = OrganizationName.safeParse(c.var.form.organizationName)
    if (!name.success) {
      return renderHome(c, auth, { message: { kind: 'error', text: FIELD_ERRORS.organizationName } }, 400)
    }
    orgs.renameOrganization(organization.id, name.data)
    return c.redirect(`${CONSOLE_PATH}?notice=renamed`, 303)
  })

  app.post(`${CONSOLE_PATH}/organization/azure-devops`, async (c) => {
    const auth = signedIn(c)
    const organization = auth ? orgs.findOwnedOrganization(auth.user.id) : undefined
    if (!auth || !organization) {
      return auth ? c.redirect(CONSOLE_PATH, 303) : toLogin(c)
    }
    const organizationUrl = (c.var.form.organizationUrl ?? '').slice(0, 2048)
    // The PAT is never re-rendered, logged or stored; it lives only for this request.
    const pat = c.var.form.pat ?? ''
    const fail = (text: string, status: 400 | 409 | 502) =>
      renderHome(c, auth, { organizationUrl, message: { kind: 'error', text } }, status)
    const target = parseAzureDevOpsOrganizationUrl(organizationUrl)
    if (!target) {
      return fail('Use a URL da organização: https://dev.azure.com/sua-org ou https://sua-org.visualstudio.com.', 400)
    }
    if (!pat || pat.length > 1024) {
      return fail('Informe o Personal Access Token (PAT).', 400)
    }
    const proof =
      config.azureDevOpsOrgProof === 'admin'
        ? await verifier.verifyAdministrator(target, pat, 'pat')
        : await verifier.verifyMember(target, pat, 'pat')
    if (proof.status === 'invalid-credentials') {
      return fail(
        proof.reason === 'public-org-scope'
          ? 'Esta organização tem projetos públicos, então precisamos confirmar que você é membro dela. ' +
              'Gere um PAT com o escopo "Project and team (Read)" (vso.project) e tente de novo.'
          : 'O Azure DevOps recusou o token. Confira o PAT e a URL da organização.',
        400
      )
    }
    if (proof.status === 'not-admin') {
      return fail(
        'O token não comprova que você é Administrador da Coleção de Projetos (Project Collection Administrator) desta organização.',
        400
      )
    }
    if (proof.status === 'unavailable') {
      return fail('Não foi possível falar com o Azure DevOps agora. Tente de novo em instantes.', 502)
    }
    const at = now()
    const registered = orgs.registerAzureDevOps({
      org_id: organization.id,
      organization_name: target.organizationName,
      instance_id: proof.instanceId,
      verified_at: at,
      verified_by: auth.user.id
    })
    if (registered === 'taken') {
      return fail('Organização do Azure DevOps já cadastrada por outra organização do Dolphin.', 409)
    }
    orgs.recordAzureDevOpsMember({
      orgId: organization.id,
      userId: auth.user.id,
      azureDevOpsUserId: proof.azureDevOpsUserId,
      now: at
    })
    return c.redirect(`${CONSOLE_PATH}?notice=connected`, 303)
  })

  return app
}
