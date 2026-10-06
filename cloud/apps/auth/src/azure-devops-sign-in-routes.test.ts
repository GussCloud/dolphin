import { createHash, randomBytes } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { AZURE_DEVOPS_ONLY_PASSWORD } from './azure-devops-identity-store.js'
import { verifyPassword } from './secrets.js'
import { issueSession } from './session-service.js'
import { ConsoleBrowser } from './test-fixtures/console-browser.js'
import { createTestAuthApp, dumpDatabase } from './test-fixtures/auth-test-app.js'
import { OUTAGE_TOKEN } from './test-fixtures/fake-azure-devops.js'

const SIGN_IN = '/v1/desktop/auth/azure-devops'
const LINK = '/v1/desktop/orgs/azure-devops/link'
const CONTOSO_ID = '22222222-2222-4222-8222-222222222222'
const FABRIKAM_ID = '33333333-3333-4333-8333-333333333333'
const OPEN_ID = '44444444-4444-4444-8444-444444444444'
const NORTHWIND_ID = '55555555-5555-4555-8555-555555555555'

const NEW_TOKEN = 'fake-token-not-a-secret-new-person'
const DISPLAY_EMAIL_TOKEN = 'fake-token-not-a-secret-email-as-display-name'
const NO_EMAIL_TOKEN = 'fake-token-not-a-secret-no-email'
const COLLIDING_TOKEN = 'fake-token-not-a-secret-colliding-email'
const LINKER_TOKEN = 'fake-token-not-a-secret-linker'
const OUTSIDER_TOKEN = 'fake-token-not-a-secret-public-outsider'
const CONSOLE_ADMIN_PAT = 'fake-pat-not-a-secret-console-admin'
const ALL_TOKENS = [NEW_TOKEN, DISPLAY_EMAIL_TOKEN, NO_EMAIL_TOKEN, COLLIDING_TOKEN, LINKER_TOKEN, CONSOLE_ADMIN_PAT]

const SignInAnswer = z
  .object({
    status: z.string().optional(),
    accountCreated: z.boolean().optional(),
    session: z
      .object({
        accessToken: z.string(),
        refreshToken: z.string(),
        cloud: z.object({ userId: z.string(), email: z.string(), displayName: z.string().optional() })
      })
      .passthrough()
      .optional()
  })
  .passthrough()

const sessionOf = (body: z.infer<typeof SignInAnswer>) => body.session ?? expect.unreachable()

let ctx: Awaited<ReturnType<typeof createTestAuthApp>>

const azdoId = (n: number) => `dddddddd-0000-4000-8000-00000000000${n}`
const person = (n: number, profile: { account?: string; providerDisplayName?: string; orgMember?: boolean }) => ({
  id: azdoId(n),
  admin: false,
  ...profile
})

function registerOrganization(
  orgId: string,
  name: string,
  azureDevOpsName: string,
  ownerId: string,
  instanceId: string
) {
  const orgs = ctx.store.organizations
  orgs.createOrganization({ id: orgId, name, ownerId, now: Date.now() })
  orgs.registerAzureDevOps({
    org_id: orgId,
    organization_name: azureDevOpsName,
    instance_id: instanceId,
    verified_at: Date.now(),
    verified_by: ownerId
  })
}

beforeEach(async () => {
  ctx = await createTestAuthApp({
    orgs: [
      {
        name: 'contoso',
        instanceId: CONTOSO_ID,
        members: new Map([
          [NEW_TOKEN, person(1, { account: 'Nova.Pessoa@Example.com', providerDisplayName: 'Nova Pessoa' })],
          // Live dev.azure.com/evuptec shape: the email is the provider display name.
          [DISPLAY_EMAIL_TOKEN, person(2, { providerDisplayName: 'Gus@Evup.Example' })],
          [NO_EMAIL_TOKEN, person(3, { providerDisplayName: 'Sem Email' })],
          [COLLIDING_TOKEN, person(4, { account: 'member@example.com' })],
          [LINKER_TOKEN, person(5, { account: 'work-account@corp.example' })]
        ])
      },
      {
        name: 'fabrikam',
        instanceId: FABRIKAM_ID,
        members: new Map([[NEW_TOKEN, person(1, { account: 'nova.pessoa@example.com' })]])
      },
      {
        name: 'open-source',
        instanceId: OPEN_ID,
        publicProjects: true,
        members: new Map([[OUTSIDER_TOKEN, person(6, { orgMember: false, account: 'outsider@example.com' })]])
      },
      {
        name: 'northwind',
        instanceId: NORTHWIND_ID,
        members: new Map([[CONSOLE_ADMIN_PAT, { ...person(7, { account: 'boss@corp.example' }), admin: true }]])
      }
    ]
  })
  await ctx.createUser('usr_owner', 'owner@example.com')
  await ctx.createUser('usr_member', 'member@example.com')
  await ctx.createUser('usr_other', 'other@example.com')
  registerOrganization('corg_contoso', 'Contoso', 'contoso', 'usr_owner', CONTOSO_ID)
  registerOrganization('corg_open', 'Open', 'open-source', 'usr_other', OPEN_ID)
})

afterEach(() => {
  vi.restoreAllMocks()
  ctx.dispose()
})

const contoso = (azureDevOpsToken: string, tokenKind: 'bearer' | 'pat' = 'bearer') => ({
  organizationUrl: 'https://dev.azure.com/contoso',
  azureDevOpsToken,
  tokenKind
})

async function signIn(body: unknown) {
  const res = await ctx.app.request(SIGN_IN, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
  return { status: res.status, body: SignInAnswer.parse(await res.json()) }
}

function link(access: string, body: unknown) {
  return ctx.app.request(LINK, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${access}` },
    body: JSON.stringify(body)
  })
}

const accessFor = (userId: string) =>
  issueSession(ctx.store, ctx.config, ctx.store.findUser(userId) ?? expect.unreachable()).accessToken

const userCount = () => ctx.store.listUsers().length
const memberIds = (orgId: string) => ctx.store.organizations.listMembers(orgId).map((m) => m.user_id).sort()

describe('sign in to Dolphin with Azure DevOps', () => {
  it('creates the account, joins the org and returns a full desktop session', async () => {
    const { status, body } = await signIn({ ...contoso(NEW_TOKEN), localProfileId: 'local-1' })
    expect(status).toBe(200)
    expect(body).toMatchObject({
      status: 'signed-in',
      organization: { id: 'corg_contoso', name: 'Contoso' },
      azureDevOps: { organizationName: 'contoso', instanceId: CONTOSO_ID },
      accountCreated: true
    })
    const expectedShape = issueSession(ctx.store, ctx.config, ctx.store.findUser('usr_owner') ?? expect.unreachable())
    expect(Object.keys(sessionOf(body)).sort()).toEqual(Object.keys(expectedShape).sort())
    expect(sessionOf(body).cloud).toMatchObject({ email: 'nova.pessoa@example.com', displayName: 'Nova Pessoa' })

    const user = ctx.store.findUserByEmail('nova.pessoa@example.com') ?? expect.unreachable()
    expect(sessionOf(body).cloud.userId).toBe(user.id)
    expect(user.id).toMatch(/^usr_[0-9a-f]{32}$/)
    expect(user.password_hash).toBe(AZURE_DEVOPS_ONLY_PASSWORD)
    expect(ctx.store.azureDevOpsIdentities.findUserId(azdoId(1))).toBe(user.id)
    expect(ctx.store.organizations.listMembers('corg_contoso').find((m) => m.user_id === user.id)).toMatchObject({
      role: 'member',
      source: 'azure-devops'
    })
    expect(ctx.store.listUsers().find((row) => row.id === user.id)?.azure_devops).toBe('yes')
    expect(ctx.store.listUsers().find((row) => row.id === 'usr_member')?.azure_devops).toBe('')

    const org = await ctx.app.request('/v1/desktop/auth/org', {
      method: 'POST',
      headers: { authorization: `Bearer ${sessionOf(body).accessToken}` }
    })
    expect(org.status).toBe(200)
    const refreshed = await ctx.app.request('/v1/desktop/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: sessionOf(body).refreshToken })
    })
    expect(refreshed.status).toBe(200)
    expect(((await refreshed.json()) as { cloud: { userId: string } }).cloud.userId).toBe(user.id)
  })

  it('reuses the same account on the next sign-in', async () => {
    const first = await signIn(contoso(NEW_TOKEN))
    const users = userCount()
    const second = await signIn(contoso(NEW_TOKEN, 'pat'))
    expect(second.body).toMatchObject({ status: 'signed-in', accountCreated: false })
    expect(sessionOf(second.body).cloud.userId).toBe(sessionOf(first.body).cloud.userId)
    expect(userCount()).toBe(users)
    expect(memberIds('corg_contoso')).toHaveLength(2)
  })

  it('reads the email from providerDisplayName when Account is absent, lowercased', async () => {
    const { body } = await signIn(contoso(DISPLAY_EMAIL_TOKEN))
    expect(body).toMatchObject({ status: 'signed-in', accountCreated: true })
    expect(sessionOf(body).cloud.email).toBe('gus@evup.example')
  })

  it('creates nothing when the identity exposes no email', async () => {
    const users = userCount()
    expect((await signIn(contoso(NO_EMAIL_TOKEN))).body).toEqual({ status: 'invalid-credentials' })
    expect(userCount()).toBe(users)
    expect(memberIds('corg_contoso')).toEqual(['usr_owner'])
  })

  it('never merges into an existing account with the same email', async () => {
    const users = userCount()
    expect((await signIn(contoso(COLLIDING_TOKEN))).body).toEqual({ status: 'account-exists' })
    expect(userCount()).toBe(users)
    expect(ctx.store.azureDevOpsIdentities.findUserId(azdoId(4))).toBeUndefined()
    expect(memberIds('corg_contoso')).toEqual(['usr_owner'])
    // After one password sign-in the link endpoint binds it, and AzDO alone signs in from then on.
    expect((await link(accessFor('usr_member'), contoso(COLLIDING_TOKEN))).status).toBe(200)
    const { body } = await signIn(contoso(COLLIDING_TOKEN))
    expect(body).toMatchObject({ status: 'signed-in', accountCreated: false })
    expect(sessionOf(body).cloud.userId).toBe('usr_member')
  })

  it('answers not-registered for an AzDO org no Dolphin org claimed, creating nothing', async () => {
    const users = userCount()
    expect((await signIn({ ...contoso(NEW_TOKEN), organizationUrl: 'https://fabrikam.visualstudio.com' })).body).toEqual({
      status: 'not-registered'
    })
    expect(userCount()).toBe(users)
    expect(ctx.store.azureDevOpsIdentities.findUserId(azdoId(1))).toBeUndefined()
  })

  it('rejects bad tokens, public-org outsiders, other hosts, malformed bodies and outages', async () => {
    const users = userCount()
    expect((await signIn(contoso('fake-token-unknown'))).body).toEqual({ status: 'invalid-credentials' })
    expect(
      (await signIn({ ...contoso(OUTSIDER_TOKEN), organizationUrl: 'https://dev.azure.com/open-source' })).body
    ).toEqual({ status: 'invalid-credentials', reason: 'public-org-scope' })
    expect((await signIn({ ...contoso(NEW_TOKEN), organizationUrl: 'https://evil.example/contoso' })).body).toEqual({
      status: 'unsupported-host'
    })
    expect((await signIn({ organizationUrl: 'https://dev.azure.com/contoso' })).status).toBe(400)
    expect((await signIn({ ...contoso(NEW_TOKEN), localProfileId: 'x'.repeat(257) })).status).toBe(400)
    const outage = await signIn(contoso(OUTAGE_TOKEN))
    expect(outage).toEqual({ status: 502, body: { error: 'azure_devops_unavailable' } })
    expect(userCount()).toBe(users)
  })

  it('signs the console owner into their own account via the identity bound on connect', async () => {
    ctx.store.organizations.insertInvite('inv_fake-invite-code', Date.now())
    const browser = new ConsoleBrowser(ctx.app)
    await browser.get('/console/signup')
    await browser.post('/console/signup', {
      email: 'console-owner@example.com',
      password: 'a long password!',
      displayName: 'Dona',
      organizationName: 'Northwind',
      inviteCode: 'inv_fake-invite-code'
    })
    await browser.get('/console')
    const connected = await browser.post('/console/organization/azure-devops', {
      organizationUrl: 'https://dev.azure.com/northwind',
      pat: CONSOLE_ADMIN_PAT
    })
    expect(connected.res.status).toBe(303)
    const owner = ctx.store.findUserByEmail('console-owner@example.com') ?? expect.unreachable()

    const northwind = { ...contoso(CONSOLE_ADMIN_PAT, 'pat'), organizationUrl: 'https://dev.azure.com/northwind' }
    const { body } = await signIn(northwind)
    expect(body).toMatchObject({ status: 'signed-in', accountCreated: false })
    expect(sessionOf(body).cloud.userId).toBe(owner.id)
    expect(ctx.store.findUserByEmail('boss@corp.example')).toBeUndefined()
    const orgId = ctx.store.organizations.findOwnedOrganization(owner.id)?.id ?? expect.unreachable()
    expect(ctx.store.organizations.listMembers(orgId)).toMatchObject([
      { user_id: owner.id, role: 'owner', source: 'web' }
    ])
  })

  it('binds the identity on link and never rebinds it to another user', async () => {
    const linkerId = azdoId(5)
    expect((await link(accessFor('usr_member'), contoso(LINKER_TOKEN))).status).toBe(200)
    expect(ctx.store.azureDevOpsIdentities.findUserId(linkerId)).toBe('usr_member')

    expect((await link(accessFor('usr_other'), contoso(LINKER_TOKEN))).status).toBe(200)
    expect(ctx.store.azureDevOpsIdentities.findUserId(linkerId)).toBe('usr_member')
    expect(
      ctx.store.azureDevOpsIdentities.bind({ azureDevOpsUserId: linkerId, userId: 'usr_other', email: null, now: Date.now() })
    ).toEqual({ status: 'bound-to-other', userId: 'usr_member' })

    const { body } = await signIn(contoso(LINKER_TOKEN))
    expect(sessionOf(body).cloud.userId).toBe('usr_member')
    expect(ctx.store.findUserByEmail('work-account@corp.example')).toBeUndefined()
  })

  it('creates exactly one account for concurrent first sign-ins', async () => {
    const users = userCount()
    const results = await Promise.all([
      signIn(contoso(NEW_TOKEN)),
      signIn(contoso(NEW_TOKEN, 'pat')),
      signIn(contoso(NEW_TOKEN))
    ])
    expect(results.map((r) => r.body.status)).toEqual(['signed-in', 'signed-in', 'signed-in'])
    expect(new Set(results.map((r) => sessionOf(r.body).cloud.userId)).size).toBe(1)
    expect(results.filter((r) => r.body.accountCreated)).toHaveLength(1)
    expect(userCount()).toBe(users + 1)
  })

  it('keeps every Azure DevOps token out of the database and the logs', async () => {
    const logs = (['log', 'info', 'warn', 'error', 'debug'] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => {})
    )
    for (const token of ALL_TOKENS) {
      await signIn(contoso(token))
    }
    await link(accessFor('usr_member'), contoso(LINKER_TOKEN))
    const db = dumpDatabase(ctx.store)
    const logged = JSON.stringify(logs.flatMap((spy) => spy.mock.calls))
    for (const token of ALL_TOKENS) {
      expect(db).not.toContain(token)
      expect(logged).not.toContain(token)
    }
  })
})

describe('Azure DevOps-only accounts have no password', () => {
  it('rejects the sentinel in verifyPassword, the desktop sign-in page and the console login', async () => {
    expect(await verifyPassword(AZURE_DEVOPS_ONLY_PASSWORD, AZURE_DEVOPS_ONLY_PASSWORD)).toBe(false)
    expect(await verifyPassword('', AZURE_DEVOPS_ONLY_PASSWORD)).toBe(false)
    await signIn(contoso(NEW_TOKEN))

    const verifier = randomBytes(32).toString('base64url')
    const authorize = await ctx.app.request('/v1/desktop/auth/authorize', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: ctx.config.clientId,
        redirect_uri: 'http://127.0.0.1:51234/auth/callback',
        state: randomBytes(32).toString('base64url'),
        nonce: randomBytes(32).toString('base64url'),
        code_challenge: createHash('sha256').update(verifier).digest('base64url'),
        local_profile_id: 'local-1',
        email: 'nova.pessoa@example.com',
        password: AZURE_DEVOPS_ONLY_PASSWORD,
        action: 'login'
      })
    })
    expect(authorize.status).toBe(401)

    const browser = new ConsoleBrowser(ctx.app)
    await browser.get('/console/login')
    const login = await browser.post('/console/login', {
      email: 'nova.pessoa@example.com',
      password: AZURE_DEVOPS_ONLY_PASSWORD
    })
    expect(login.res.status).toBe(401)
  })
})
