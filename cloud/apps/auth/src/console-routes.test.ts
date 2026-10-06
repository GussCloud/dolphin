import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConsoleBrowser } from './test-fixtures/console-browser.js'
import { createTestAuthApp, dumpDatabase, TEST_PASSWORD } from './test-fixtures/auth-test-app.js'
import type { FakeAzureDevOpsOrg } from './test-fixtures/fake-azure-devops.js'

const ADMIN_PAT = 'fake-pat-not-a-secret-admin'
const MEMBER_PAT = 'fake-pat-not-a-secret-member'
const CONTOSO_ID = '11111111-1111-4111-8111-111111111111'

const contoso = (): FakeAzureDevOpsOrg => ({
  name: 'contoso',
  instanceId: CONTOSO_ID,
  members: new Map([
    [ADMIN_PAT, { id: 'aaaaaaaa-0000-4000-8000-000000000001', admin: true }],
    [MEMBER_PAT, { id: 'aaaaaaaa-0000-4000-8000-000000000002', admin: false }]
  ])
})

let ctx: Awaited<ReturnType<typeof createTestAuthApp>>

afterEach(() => {
  vi.restoreAllMocks()
  ctx.dispose()
})

async function setup(env: NodeJS.ProcessEnv = {}) {
  ctx = await createTestAuthApp({ orgs: [contoso()], env })
  return ctx
}

function invite(code = 'inv_fake-invite-code'): string {
  ctx.store.organizations.insertInvite(code, Date.now())
  return code
}

async function signUp(browser: ConsoleBrowser, fields: Partial<Record<string, string>> = {}) {
  await browser.get('/console/signup')
  return browser.post('/console/signup', {
    email: 'owner@example.com',
    password: 'a long password!',
    displayName: 'Ana Dona',
    organizationName: 'Contoso Brasil',
    inviteCode: 'inv_fake-invite-code',
    ...fields
  })
}

async function signedInOwner() {
  invite()
  const browser = new ConsoleBrowser(ctx.app)
  expect((await signUp(browser)).res.status).toBe(303)
  await browser.get('/console')
  return browser
}

function connect(browser: ConsoleBrowser, pat: string, organizationUrl = 'https://dev.azure.com/Contoso') {
  return browser.post('/console/organization/azure-devops', { organizationUrl, pat })
}

describe('console sign-up and sign-in', () => {
  it('redirects anonymous visitors to the login page', async () => {
    await setup()
    const res = await ctx.app.request('/console')
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/console/login')
  })

  it('refuses sign-up without a valid invite and creates nothing', async () => {
    await setup()
    const page = await signUp(new ConsoleBrowser(ctx.app), { inviteCode: 'inv_never-issued' })
    expect(page.res.status).toBe(400)
    expect(page.html).toContain('Código de convite inválido ou já utilizado.')
    expect(ctx.store.findUserByEmail('owner@example.com')).toBeUndefined()
    expect(ctx.store.organizations.listOrganizations()).toEqual([])
  })

  it('creates user, org and owner membership from an invite, and the invite works only once', async () => {
    await setup()
    const browser = await signedInOwner()
    const home = await browser.get('/console')
    expect(home.html).toContain('Contoso Brasil')
    expect(home.html).toContain('Proprietário')
    const [org] = ctx.store.organizations.listOrganizations()
    expect(org?.id).toMatch(/^corg_/)
    expect(org?.owner_email).toBe('owner@example.com')

    const second = await signUp(new ConsoleBrowser(ctx.app), { email: 'other@example.com' })
    expect(second.res.status).toBe(400)
    expect(ctx.store.findUserByEmail('other@example.com')).toBeUndefined()
  })

  it('sets a path-scoped, httpOnly, Secure, SameSite=Lax session cookie', async () => {
    await setup()
    const browser = await signedInOwner()
    const session = browser.setCookieHeaders.find((h) => h.startsWith('dolphin_console='))
    expect(session).toMatch(/Path=\/console/)
    expect(session).toMatch(/HttpOnly/)
    expect(session).toMatch(/Secure/)
    expect(session).toMatch(/SameSite=Lax/)
  })

  it('rejects POSTs without the CSRF token', async () => {
    await setup()
    const anonymous = new ConsoleBrowser(ctx.app)
    await anonymous.get('/console/signup')
    const res = await anonymous.post(
      '/console/signup',
      { email: 'x@example.com', password: 'a long password!', displayName: 'X', organizationName: 'X', inviteCode: 'inv_fake-invite-code' },
      { csrf: false }
    )
    expect(res.res.status).toBe(403)

    const owner = await signedInOwner()
    const rename = await owner.post('/console/organization/name', { organizationName: 'Hacked' }, { csrf: false })
    expect(rename.res.status).toBe(403)
    const forged = await owner.post('/console/organization/name', { organizationName: 'Hacked', _csrf: 'csrf_forged' }, { csrf: false })
    expect(forged.res.status).toBe(403)
    expect(ctx.store.organizations.listOrganizations()[0]?.name).toBe('Contoso Brasil')
  })

  it('lets an admin-cli user log in, requires an invite to create an org, and allows only one', async () => {
    await setup()
    await ctx.createUser('usr_cli', 'cli@example.com')
    const browser = new ConsoleBrowser(ctx.app)
    await browser.get('/console/login')
    expect((await browser.post('/console/login', { email: 'cli@example.com', password: 'wrong password!' })).res.status).toBe(401)
    expect((await browser.post('/console/login', { email: 'cli@example.com', password: TEST_PASSWORD })).res.status).toBe(303)
    const home = await browser.get('/console')
    expect(home.html).toContain('Criar organização')

    const noInvite = await browser.post('/console/organization', { organizationName: 'CLI Org', inviteCode: 'inv_missing' })
    expect(noInvite.res.status).toBe(400)
    invite('inv_cli-1')
    expect((await browser.post('/console/organization', { organizationName: 'CLI Org', inviteCode: 'inv_cli-1' })).res.status).toBe(303)
    invite('inv_cli-2')
    await browser.get('/console')
    await browser.post('/console/organization', { organizationName: 'Second', inviteCode: 'inv_cli-2' })
    expect(ctx.store.organizations.listOrganizations().map((o) => o.name)).toEqual(['CLI Org'])
    // The second invite was not burned by the refused attempt.
    expect(ctx.store.organizations.consumeInvite('inv_cli-2', 'usr_cli', Date.now())).toBe(true)
  })

  it('logs out and forgets the session', async () => {
    await setup()
    const browser = await signedInOwner()
    expect((await browser.post('/console/logout', {})).res.status).toBe(303)
    expect((await browser.get('/console')).res.headers.get('location')).toBe('/console/login')
  })
})

describe('console organization page', () => {
  it('renames the org and escapes it in HTML', async () => {
    await setup()
    const browser = await signedInOwner()
    expect((await browser.post('/console/organization/name', { organizationName: '<script>x</script>' })).res.status).toBe(303)
    const home = await browser.get('/console?notice=renamed')
    expect(home.html).not.toContain('<script>x</script>')
    expect(home.html).toContain('&#60;script&#62;')
    expect(home.html).toContain('Nome da organização salvo.')
  })

  it('in admin mode, rejects a non-admin PAT and accepts a Project Collection Administrator', async () => {
    await setup()
    const browser = await signedInOwner()
    const refused = await connect(browser, MEMBER_PAT)
    expect(refused.res.status).toBe(400)
    expect(refused.html).toContain('Administrador da Coleção de Projetos')
    expect(ctx.store.organizations.listOrganizations()[0]?.azure_devops_name).toBeNull()

    expect((await connect(browser, ADMIN_PAT)).res.status).toBe(303)
    const home = await browser.get('/console?notice=connected')
    expect(home.html).toContain('Conectado')
    expect(home.html).toContain(CONTOSO_ID)
    expect(ctx.store.organizations.listOrganizations()[0]?.azure_devops_name).toBe('contoso')
  })

  it('in member mode, accepts any member PAT', async () => {
    await setup({ AZDO_ORG_PROOF: 'member' })
    const browser = await signedInOwner()
    expect((await connect(browser, MEMBER_PAT)).res.status).toBe(303)
    expect(ctx.azure.calls.some((call) => call.url.includes('/_apis/permissions/'))).toBe(false)
  })

  it('reports an invalid PAT and an unsupported host', async () => {
    await setup()
    const browser = await signedInOwner()
    const invalid = await connect(browser, 'fake-pat-not-a-secret-unknown')
    expect(invalid.html).toContain('O Azure DevOps recusou o token.')
    const host = await connect(browser, ADMIN_PAT, 'https://evil.example/contoso')
    expect(host.res.status).toBe(400)
    expect(host.html).toContain('https://dev.azure.com/sua-org')
    expect(ctx.azure.calls.some((call) => call.url.includes('evil.example'))).toBe(false)
  })

  it('refuses an Azure DevOps org already registered by another Dolphin org', async () => {
    await setup()
    const first = await signedInOwner()
    expect((await connect(first, ADMIN_PAT)).res.status).toBe(303)

    invite('inv_second')
    const second = new ConsoleBrowser(ctx.app)
    await signUp(second, { email: 'rival@example.com', organizationName: 'Rival', inviteCode: 'inv_second' })
    await second.get('/console')
    const taken = await connect(second, ADMIN_PAT, 'https://contoso.visualstudio.com')
    expect(taken.res.status).toBe(409)
    expect(taken.html).toContain('já cadastrada por outra organização')
  })

  it('never stores, logs or echoes the PAT', async () => {
    await setup()
    const logged: unknown[] = []
    for (const level of ['log', 'error', 'warn', 'info', 'debug'] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => void logged.push(...args))
    }
    const browser = await signedInOwner()
    const refused = await connect(browser, MEMBER_PAT)
    const accepted = await connect(browser, ADMIN_PAT)
    const home = await browser.get('/console')
    for (const html of [refused.html, accepted.html, home.html]) {
      expect(html).not.toContain(MEMBER_PAT)
      expect(html).not.toContain(ADMIN_PAT)
    }
    const db = dumpDatabase(ctx.store)
    expect(db).toContain(CONTOSO_ID)
    expect(db).not.toContain(MEMBER_PAT)
    expect(db).not.toContain(ADMIN_PAT)
    expect(JSON.stringify(logged)).not.toContain('fake-pat')
  })
})
