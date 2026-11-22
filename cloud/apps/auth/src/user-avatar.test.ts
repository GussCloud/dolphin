import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchAzureDevOpsAvatar, MAX_AVATAR_BYTES, sniffImageType } from './azure-devops-avatar.js'
import type { AzureDevOpsFetch } from './azure-devops-verifier.js'
import { ConsoleBrowser } from './test-fixtures/console-browser.js'
import { createTestAuthApp } from './test-fixtures/auth-test-app.js'
import { fakeAzureDevOps, type FakeAzureDevOpsOrg } from './test-fixtures/fake-azure-devops.js'

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4])
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
const INSTANCE_ID = '22222222-2222-4222-8222-222222222222'
const AZDO_ID = 'dddddddd-0000-4000-8000-000000000001'
const TOKEN = 'fake-token-not-a-secret-avatar-person'

let ctx: Awaited<ReturnType<typeof createTestAuthApp>>
afterEach(() => ctx?.dispose())

function contoso(avatar: Uint8Array | undefined): FakeAzureDevOpsOrg {
  return {
    name: 'contoso',
    instanceId: INSTANCE_ID,
    members: new Map([[TOKEN, { id: AZDO_ID, admin: false, account: 'pessoa@example.com', providerDisplayName: 'Pessoa', ...(avatar ? { avatar } : {}) }]])
  }
}
const fakeWithAvatar = (avatar: Uint8Array | undefined) => fakeAzureDevOps([contoso(avatar)])

describe('fetchAzureDevOpsAvatar', () => {
  const fetchAvatar = (fetchImpl: AzureDevOpsFetch, tokenKind: 'bearer' | 'pat' = 'bearer') =>
    fetchAzureDevOpsAvatar({ organizationName: 'contoso', identityId: AZDO_ID, token: TOKEN, tokenKind, fetchImpl })

  it('turns the identity into a descriptor, then reads the Graph avatar', async () => {
    const azure = fakeWithAvatar(PNG)
    expect(await fetchAvatar(azure.fetch, 'pat')).toEqual({ status: 'ok', image: PNG, type: 'image/png' })
    expect(azure.calls.map((c) => new URL(c.url).pathname)).toEqual([
      `/contoso/_apis/graph/descriptors/${AZDO_ID}`,
      `/contoso/_apis/graph/Subjects/aad.${Buffer.from(AZDO_ID).toString('base64url')}/avatars`
    ])
    expect(azure.calls.every((c) => c.authorization.startsWith('Basic '))).toBe(true)
  })

  it('accepts a raw image body and refuses non-raster, oversized or missing pictures', async () => {
    const answer = (descriptorBody: unknown, avatar: Response): AzureDevOpsFetch => async (url) =>
      url.includes('/descriptors/') ? Response.json(descriptorBody) : avatar
    const raw = await fetchAvatar(answer({ value: 'aad.abc' }, new Response(PNG, { headers: { 'content-type': 'image/png' } })))
    expect(raw).toEqual({ status: 'ok', image: PNG, type: 'image/png' })
    expect(await fetchAvatar(answer({ value: 'aad.abc' }, Response.json({ value: Buffer.from(SVG).toString('base64') }))))
      .toEqual({ status: 'failed', reason: 'avatar-type' })
    const huge = new Uint8Array(MAX_AVATAR_BYTES + 1)
    huge.set(PNG)
    expect(await fetchAvatar(answer({ value: 'aad.abc' }, new Response(huge, { headers: { 'content-type': 'image/png' } }))))
      .toEqual({ status: 'failed', reason: 'avatar-size' })
    expect(await fetchAvatar(answer({ value: '../../x' }, Response.json({})))).toEqual({ status: 'failed', reason: 'descriptor-shape' })
    expect(await fetchAvatar(fakeWithAvatar(undefined).fetch)).toEqual({ status: 'failed', reason: 'avatar-request' })
    expect(await fetchAvatar(async () => { throw new Error('offline') })).toEqual({ status: 'failed', reason: 'descriptor-request' })
  })

  it('recognises PNG, JPEG, GIF and WebP only', () => {
    expect(sniffImageType(PNG)).toBe('image/png')
    expect(sniffImageType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(sniffImageType(new TextEncoder().encode('GIF89a'))).toBe('image/gif')
    expect(sniffImageType(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp')
    expect(sniffImageType(SVG)).toBeNull()
  })
})

/** Owner Ana (console) with org Contoso linked to Azure DevOps "contoso"; returns her browser. */
async function setup(avatar: Uint8Array | undefined) {
  ctx = await createTestAuthApp({ orgs: [contoso(avatar)] })
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
  const org = ctx.store.organizations.listOrganizations()[0] ?? expect.unreachable()
  ctx.store.organizations.registerAzureDevOps({
    org_id: org.id,
    organization_name: 'contoso',
    instance_id: INSTANCE_ID,
    verified_at: Date.now(),
    verified_by: org.created_by
  })
  await owner.get('/console/office')
  return { owner, ownerId: org.created_by }
}

async function signInWithAzureDevOps(): Promise<string> {
  const res = await ctx.app.request('/v1/desktop/auth/azure-devops', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ organizationUrl: 'https://dev.azure.com/contoso', azureDevOpsToken: TOKEN, tokenKind: 'bearer' })
  })
  const body: unknown = await res.json()
  const userId: unknown = Reflect.get(Reflect.get(Reflect.get(Object(body), 'session') ?? {}, 'cloud') ?? {}, 'userId')
  expect(typeof userId).toBe('string')
  return String(userId)
}

describe('work view pictures', () => {
  it('captures the Azure DevOps picture at sign-in and serves it to the org, the TV link and no one else', async () => {
    const { owner } = await setup(PNG)
    const userId = await signInWithAzureDevOps()
    await vi.waitFor(() => expect(ctx.store.avatars.settings(userId).hasAzureDevOpsImage).toBe(true))
    expect(ctx.store.avatars.resolve(userId).kind).toBe('azure-devops')

    const res = await owner.get(`/console/office/avatars/${userId}`)
    expect(res.res.status).toBe(200)
    expect(res.res.headers.get('content-type')).toBe('image/png')
    expect(res.res.headers.get('x-content-type-options')).toBe('nosniff')

    const created = await owner.post('/console/office/display-links', { label: 'TV' })
    const tv = /data-absolute-path="([^"]+)"/.exec(created.html)?.[1] ?? expect.unreachable()
    expect((await ctx.app.request(`${tv}/avatars/${userId}`)).status).toBe(200)
    expect((await ctx.app.request(`${tv}/avatars/usr_not_a_member`)).status).toBe(404)
    expect((await ctx.app.request(`/console/office/avatars/${userId}`)).status).toBe(401)
  })

  it('keeps sign-in working when Azure DevOps has no picture', async () => {
    await setup(undefined)
    const userId = await signInWithAzureDevOps()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(ctx.store.avatars.resolve(userId)).toEqual({ kind: 'initials' })
  })

  it('lets a member pick GitHub or initials, validates the login and needs a captured Azure DevOps picture', async () => {
    const { owner, ownerId } = await setup(undefined)
    expect((await owner.get(`/console/office/avatars/${ownerId}`)).res.status).toBe(404)

    const bad = await owner.post('/console/office/avatar', { source: 'github', githubLogin: 'not/valid' })
    expect(bad.res.status).toBe(400)
    const noDevops = await owner.post('/console/office/avatar', { source: 'azure-devops' })
    expect(noDevops.res.status).toBe(400)
    expect(noDevops.html).toContain('Ainda não há foto do Azure DevOps')

    const saved = await owner.post('/console/office/avatar', { source: 'github', githubLogin: 'octo-cat' })
    expect(saved.res.status).toBe(303)
    const pic = await owner.get(`/console/office/avatars/${ownerId}`)
    expect(pic.res.status).toBe(302)
    expect(pic.res.headers.get('location')).toBe('https://github.com/octo-cat.png?size=160')
    expect((await owner.get('/console/office')).html).toContain('value="octo-cat"')

    await owner.post('/console/office/avatar', { source: 'initials' })
    expect(ctx.store.avatars.resolve(ownerId)).toEqual({ kind: 'initials' })
    expect(ctx.store.avatars.settings(ownerId).githubLogin).toBe('octo-cat')
  })

  it('prefers an explicit choice over the captured picture, and the captured picture over nothing', async () => {
    await setup(undefined)
    const avatars = ctx.store.avatars
    avatars.saveAzureDevOpsImage('usr_x', PNG, 'image/png', 10)
    expect(avatars.resolve('usr_x')).toMatchObject({ kind: 'azure-devops', version: 10 })
    avatars.choose('usr_x', { source: 'github', login: 'x' }, 20)
    expect(avatars.resolve('usr_x')).toEqual({ kind: 'github', login: 'x', version: 20 })
    avatars.choose('usr_x', { source: 'initials' }, 30)
    expect(avatars.resolve('usr_x')).toEqual({ kind: 'initials' })
    avatars.choose('usr_x', { source: 'azure-devops' }, 40)
    expect(avatars.resolve('usr_x')).toMatchObject({ kind: 'azure-devops', version: 10 })
  })
})
