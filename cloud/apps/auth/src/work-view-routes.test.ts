import { afterEach, describe, expect, it } from 'vitest'
import { issueSession } from './session-service.js'
import { ConsoleBrowser } from './test-fixtures/console-browser.js'
import { TEST_PASSWORD, createTestAuthApp } from './test-fixtures/auth-test-app.js'

let ctx: Awaited<ReturnType<typeof createTestAuthApp>>

afterEach(() => ctx?.dispose())

const SNAPSHOT = {
  schemaVersion: 1,
  machineId: 'machine1',
  machineLabel: 'bruno-mbp',
  projects: [
    { id: 'p1', name: 'dolphin', agents: [{ id: 'a1', cli: 'claude', state: 'permission', branch: 'feat/pix' }] }
  ]
}

/** Owner Ana with org Contoso, member Bruno (console password too), outsider Zé with no corporate org. */
async function setup() {
  ctx = await createTestAuthApp({ streamTiming: { throttleMs: 5, keepaliveMs: 20 } })
  ctx.store.organizations.insertInvite('inv_code', Date.now())
  const owner = new ConsoleBrowser(ctx.app)
  await owner.get('/console/signup')
  await owner.post('/console/signup', {
    email: 'ana@example.com',
    password: 'a long password!',
    displayName: 'Ana Dona',
    organizationName: 'Contoso',
    inviteCode: 'inv_code'
  })
  const orgId = ctx.store.organizations.listOrganizations()[0]?.id ?? expect.unreachable()
  await ctx.createUser('usr_bruno', 'bruno@example.com')
  ctx.store.organizations.recordAzureDevOpsMember({ orgId, userId: 'usr_bruno', azureDevOpsUserId: 'azdo-b', now: 1 })
  await ctx.createUser('usr_ze', 'ze@example.com')
  const tokenFor = (id: string) => {
    const user = ctx.store.findUser(id) ?? expect.unreachable()
    return issueSession(ctx.store, ctx.config, user).accessToken
  }
  return { owner, orgId, tokenFor }
}

function put(token: string | undefined, body: unknown) {
  return ctx.app.request('/v1/desktop/work-presence', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body)
  })
}

async function memberBrowser() {
  const browser = new ConsoleBrowser(ctx.app)
  await browser.get('/console/login')
  await browser.post('/console/login', { email: 'bruno@example.com', password: TEST_PASSWORD })
  return browser
}

/** Reads the event stream until a snapshot arrives, then hangs up like a closed tab. */
async function firstSnapshot(res: Response): Promise<unknown> {
  expect(res.status).toBe(200)
  expect(res.headers.get('content-type')).toContain('text/event-stream')
  const reader = (res.body ?? expect.unreachable()).getReader()
  const decoder = new TextDecoder()
  let text = ''
  while (!/event: snapshot\ndata: .*\n\n/.test(text)) {
    const { value, done } = await reader.read()
    if (done) {
      throw new Error(`stream ended: ${text}`)
    }
    text += decoder.decode(value)
  }
  await reader.cancel()
  return JSON.parse(/data: (.*)\n/.exec(text)?.[1] ?? 'null')
}

describe('desktop work presence API', () => {
  it('requires a desktop session', async () => {
    await setup()
    expect((await put(undefined, SNAPSHOT)).status).toBe(401)
    expect((await put('at_bogus', SNAPSHOT)).status).toBe(401)
  })

  it('tells an account outside every corporate org to back off', async () => {
    const { tokenFor } = await setup()
    const res = await put(tokenFor('usr_ze'), SNAPSHOT)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'no_organization' })
  })

  it('rejects snapshots outside the contract', async () => {
    const { tokenFor } = await setup()
    expect((await put(tokenFor('usr_bruno'), { ...SNAPSHOT, schemaVersion: 0 })).status).toBe(400)
    expect((await put(tokenFor('usr_bruno'), { ...SNAPSHOT, prompt: 'x', projects: 'nope' })).status).toBe(400)
  })

  it('accepts a newer desktop snapshot, degrading unknown agent states to idle', async () => {
    const { tokenFor } = await setup()
    const [project] = SNAPSHOT.projects
    const newer = {
      ...SNAPSHOT,
      schemaVersion: 2,
      addedLater: { anything: true },
      projects: [{ ...project, agents: [{ id: 'a1', cli: 'claude', state: 'compacting', branch: null, mood: 'x' }] }]
    }
    expect((await put(tokenFor('usr_bruno'), newer)).status).toBe(200)
    const agent = ctx.workPresence.view([{ userId: 'usr_bruno', name: 'Bruno' }]).devs[0]?.projects[0]?.agents[0]
    expect(agent).toEqual({ id: 'machine1:a1', cli: 'claude', state: 'idle', branch: null })
  })

  it('accepts a member snapshot, returns the heartbeat, and removes the machine on DELETE', async () => {
    const { orgId, tokenFor } = await setup()
    const token = tokenFor('usr_bruno')
    const res = await put(token, SNAPSHOT)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ organizationId: orgId, heartbeatMs: 20_000 })
    const members = [{ userId: 'usr_bruno', name: 'Bruno' }]
    expect(ctx.workPresence.view(members).devs[0]?.projects[0]?.agents[0]?.state).toBe('permission')
    const del = await ctx.app.request('/v1/desktop/work-presence?machineId=machine1', {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` }
    })
    expect(del.status).toBe(200)
    expect(ctx.workPresence.view(members).devs).toEqual([])
    const bad = await ctx.app.request('/v1/desktop/work-presence?machineId=../x', {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` }
    })
    expect(bad.status).toBe(400)
  })
})

describe('console work view', () => {
  it('sends signed-out visitors to the login page and refuses their stream', async () => {
    await setup()
    const visitor = new ConsoleBrowser(ctx.app)
    const page = await visitor.get('/console/office')
    expect(page.res.status).toBe(303)
    expect(page.res.headers.get('location')).toBe('/console/login')
    expect((await ctx.app.request('/console/office/stream')).status).toBe(401)
  })

  it('shows any member the live view, without the owner-only display links', async () => {
    const { tokenFor } = await setup()
    await put(tokenFor('usr_bruno'), SNAPSHOT)
    const bruno = await memberBrowser()
    const page = await bruno.get('/console/office')
    expect(page.res.status).toBe(200)
    expect(page.html).toContain('Escritório dos agentes')
    expect(page.html).toContain('data-stream="/console/office/stream"')
    expect(page.html).not.toContain('Links de exibição')
    const cookie = [...bruno.cookies].map(([k, v]) => `${k}=${v}`).join('; ')
    const view = await firstSnapshot(await ctx.app.request('/console/office/stream', { headers: { cookie } }))
    expect(view).toEqual({
      devs: [
        {
          id: 'usr_bruno',
          name: 'bruno',
          machines: ['bruno-mbp'],
          status: 'online',
          projects: [
            {
              id: 'machine1:p1',
              name: 'dolphin',
              agents: [{ id: 'machine1:a1', cli: 'claude', state: 'permission', branch: 'feat/pix' }]
            }
          ]
        }
      ]
    })
  })

  it('lets the owner create a TV link shown once, which works without sign-in until revoked', async () => {
    const { owner } = await setup()
    const page = await owner.get('/console/office')
    expect(page.html).toContain('Links de exibição (TV)')
    const created = await owner.post('/console/office/display-links', { label: 'TV da recepção' })
    expect(created.res.status).toBe(200)
    const path = /data-absolute-path="([^"]+)"/.exec(created.html)?.[1] ?? expect.unreachable()
    expect(path).toMatch(/^\/console\/tv\/tv_/)
    expect(created.html).toContain('TV da recepção')
    expect((await owner.get('/console/office')).html).not.toContain(path)

    const tv = await ctx.app.request(path)
    expect(tv.status).toBe(200)
    const html = await tv.text()
    expect(html).toContain('Contoso')
    expect(html).not.toContain('class="sidebar"')
    expect(await firstSnapshot(await ctx.app.request(`${path}/stream`))).toEqual({ devs: [] })

    const linkId = /display-links\/(odl_[a-z0-9]+)\/revoke/.exec(created.html)?.[1] ?? expect.unreachable()
    const revoked = await owner.post(`/console/office/display-links/${linkId}/revoke`, {})
    expect(revoked.res.status).toBe(303)
    expect((await ctx.app.request(path)).status).toBe(404)
    expect((await ctx.app.request(`${path}/stream`)).status).toBe(404)
  })

  it('refuses display link changes from members and requests without CSRF', async () => {
    const { owner } = await setup()
    const bruno = await memberBrowser()
    await bruno.get('/console/office')
    const attempt = await bruno.post('/console/office/display-links', { label: 'x' })
    expect(attempt.res.status).toBe(303)
    expect(ctx.store.officeDisplayLinks.listActive(ctx.store.organizations.listOrganizations()[0]?.id ?? '')).toEqual([])
    await owner.get('/console/office')
    const forged = await owner.post('/console/office/display-links', { label: 'x' }, { csrf: false })
    expect(forged.res.status).toBe(403)
  })

  it('serves the office scripts', async () => {
    await setup()
    for (const name of ['office-scene.js', 'office-fit.js', 'office-engine.js', 'office-client.js']) {
      const res = await ctx.app.request(`/console/assets/office/${name}`)
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain('javascript')
    }
    expect((await ctx.app.request('/console/assets/office/..%2Fapp.js')).status).toBe(404)
  })
})
