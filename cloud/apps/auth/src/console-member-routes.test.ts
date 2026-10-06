import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import { OrganizationStore } from './organization-store.js'
import { ConsoleBrowser } from './test-fixtures/console-browser.js'
import { createTestAuthApp } from './test-fixtures/auth-test-app.js'

let ctx: Awaited<ReturnType<typeof createTestAuthApp>>
let disposeCtx: (() => void) | undefined

afterEach(() => {
  disposeCtx?.()
  disposeCtx = undefined
})

// 2026-03-10 and 2026-05-20, noon in São Paulo.
const MARCH = Date.parse('2026-03-10T12:00:00-03:00')
const MAY = Date.parse('2026-05-20T12:00:00-03:00')

async function ownerWithMembers() {
  ctx = await createTestAuthApp({ orgs: [] })
  disposeCtx = ctx.dispose
  ctx.store.organizations.insertInvite('inv_fake-invite-code', Date.now())
  const browser = new ConsoleBrowser(ctx.app)
  await browser.get('/console/signup')
  await browser.post('/console/signup', {
    email: 'owner@example.com',
    password: 'a long password!',
    displayName: 'Ana Dona',
    organizationName: 'Contoso Brasil',
    inviteCode: 'inv_fake-invite-code'
  })
  const [org] = ctx.store.organizations.listOrganizations()
  const orgId = org?.id ?? expect.unreachable()
  const seed = (id: string, email: string, displayName: string, joined: number) => {
    ctx.store.createUser({ id, email, passwordHash: 'x', displayName })
    ctx.store.organizations.recordAzureDevOpsMember({ orgId, userId: id, azureDevOpsUserId: `azdo-${id}`, now: joined })
  }
  seed('usr_bruno', 'bruno@example.com', 'Bruno Silva', MARCH)
  seed('usr_carla', 'carla_100%@example.com', 'Carla Souza', MAY)
  await browser.get('/console/members')
  return { browser, orgId }
}

describe('console members page', () => {
  it('lists members with filters by name/e-mail and join date', async () => {
    const { browser } = await ownerWithMembers()
    const all = await browser.get('/console/members')
    expect(all.res.status).toBe(200)
    for (const name of ['Ana Dona', 'Bruno Silva', 'Carla Souza']) {
      expect(all.html).toContain(name)
    }
    const byName = await browser.get('/console/members?q=bruno')
    expect(byName.html).toContain('Bruno Silva')
    expect(byName.html).not.toContain('Carla Souza')
    // LIKE wildcards in the search are literal.
    const literal = await browser.get('/console/members?q=100%25')
    expect(literal.html).toContain('Carla Souza')
    expect(literal.html).not.toContain('Bruno Silva')
    const byDate = await browser.get('/console/members?from=2026-03-01&to=2026-03-10')
    expect(byDate.html).toContain('Bruno Silva')
    expect(byDate.html).not.toContain('Carla Souza')
    const impossible = await browser.get('/console/members?to=2026-02-31')
    expect(impossible.html).toContain('Carla Souza')
    const none = await browser.get('/console/members?q=ninguem')
    expect(none.html).toContain('Nenhum membro encontrado')
  })

  it('sets an org-scoped name without touching the account, and clears it back', async () => {
    const { browser, orgId } = await ownerWithMembers()
    const saved = await browser.post('/console/members/usr_bruno/name', { nickname: '<b>Bruninho</b>', q: 'bru' })
    expect(saved.res.status).toBe(303)
    expect(saved.res.headers.get('location')).toBe('/console/members?q=bru&notice=member-renamed')
    const page = await browser.get('/console/members?notice=member-renamed')
    expect(page.html).toContain('&#60;b&#62;Bruninho&#60;/b&#62;')
    expect(page.html).toContain('Nome do membro salvo.')
    expect(ctx.store.findUser('usr_bruno')?.display_name).toBe('Bruno Silva')

    // An Azure DevOps sign-in refreshes the identity but keeps the owner's name.
    ctx.store.organizations.recordAzureDevOpsMember({ orgId, userId: 'usr_bruno', azureDevOpsUserId: 'x', now: 1 })
    expect(ctx.store.organizations.listMembers(orgId).find((m) => m.user_id === 'usr_bruno')?.nickname).toBe(
      '<b>Bruninho</b>'
    )

    await browser.post('/console/members/usr_bruno/name', { nickname: '  ' })
    expect(ctx.store.organizations.listMembers(orgId).find((m) => m.user_id === 'usr_bruno')?.nickname).toBeNull()
    expect((await browser.post('/console/members/usr_nobody/name', { nickname: 'x' })).res.status).toBe(404)
  })

  it('removes a member from the org only, and never the owner', async () => {
    const { browser, orgId } = await ownerWithMembers()
    const removed = await browser.post('/console/members/usr_carla/delete', {})
    expect(removed.res.headers.get('location')).toBe('/console/members?notice=member-removed')
    expect(ctx.store.organizations.listMembers(orgId).map((m) => m.user_id)).not.toContain('usr_carla')
    expect(ctx.store.findUser('usr_carla')).toBeDefined()

    const owner = ctx.store.findUserByEmail('owner@example.com') ?? expect.unreachable()
    const refused = await browser.post(`/console/members/${owner.id}/delete`, {})
    expect(refused.res.status).toBe(400)
    expect(refused.html).toContain('O proprietário não pode ser removido.')
    expect((await browser.post('/console/members/usr_carla/delete', {})).res.status).toBe(404)
  })

  it('requires the CSRF token and a signed-in owner', async () => {
    const { browser } = await ownerWithMembers()
    const forged = await browser.post('/console/members/usr_carla/delete', {}, { csrf: false })
    expect(forged.res.status).toBe(403)
    const anonymous = await new ConsoleBrowser(ctx.app).get('/console/members')
    expect(anonymous.res.headers.get('location')).toBe('/console/login')
  })
})

describe('organization store migration', () => {
  it('adds the nickname column to a database created before it existed', () => {
    const db = new DatabaseSync(':memory:')
    db.exec(`CREATE TABLE organization_members (org_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL,
      source TEXT NOT NULL, azure_devops_user_id TEXT, joined_at INTEGER NOT NULL, PRIMARY KEY (org_id, user_id))`)
    new OrganizationStore(db)
    const columns = db.prepare('PRAGMA table_info(organization_members)').all() as { name: string }[]
    expect(columns.map((c) => c.name)).toContain('nickname')
    db.close()
  })
})
