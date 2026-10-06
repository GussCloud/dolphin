import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { issueSession } from './session-service.js'
import { createTestAuthApp, dumpDatabase } from './test-fixtures/auth-test-app.js'
import { OUTAGE_TOKEN, PUBLIC_ACCESS_IDENTITY, SIGN_IN_REDIRECT_TOKEN } from './test-fixtures/fake-azure-devops.js'

const MEMBER_TOKEN = 'fake-token-not-a-secret-member'
const OWNER_TOKEN = 'fake-token-not-a-secret-owner'
const CONTOSO_ID = '22222222-2222-4222-8222-222222222222'
const FABRIKAM_ID = '33333333-3333-4333-8333-333333333333'
const OPEN_ID = '44444444-4444-4444-8444-444444444444'
const BUILD_SERVICE_TOKEN = 'fake-token-not-a-secret-build-service'
const IMPERSONATED_TOKEN = 'fake-token-not-a-secret-impersonated'
const MEMBER_AZDO_ID = 'bbbbbbbb-0000-4000-8000-000000000001'
const LINK = '/v1/desktop/orgs/azure-devops/link'

let ctx: Awaited<ReturnType<typeof createTestAuthApp>>
let memberAccess: string
let ownerAccess: string

beforeEach(async () => {
  ctx = await createTestAuthApp({
    orgs: [
      {
        name: 'contoso',
        instanceId: CONTOSO_ID,
        members: new Map([
          [MEMBER_TOKEN, { id: MEMBER_AZDO_ID, admin: false }],
          [OWNER_TOKEN, { id: 'bbbbbbbb-0000-4000-8000-000000000002', admin: true }]
        ])
      },
      { name: 'fabrikam', instanceId: FABRIKAM_ID, members: new Map([[MEMBER_TOKEN, { id: MEMBER_AZDO_ID, admin: false }]]) },
      {
        name: 'open-source',
        instanceId: OPEN_ID,
        publicProjects: true,
        members: new Map([
          [MEMBER_TOKEN, { id: MEMBER_AZDO_ID, admin: false }],
          [
            BUILD_SERVICE_TOKEN,
            {
              id: 'cccccccc-0000-4000-8000-000000000001',
              admin: false,
              descriptor: `Microsoft.TeamFoundation.ServiceIdentity;fake-build:Build:${OPEN_ID}`
            }
          ],
          [
            IMPERSONATED_TOKEN,
            {
              id: 'cccccccc-0000-4000-8000-000000000002',
              admin: false,
              authorizedAs: { id: PUBLIC_ACCESS_IDENTITY.id, descriptor: PUBLIC_ACCESS_IDENTITY.descriptor }
            }
          ]
        ])
      }
    ]
  })
  await ctx.createUser('usr_member', 'member@example.com')
  await ctx.createUser('usr_owner', 'owner@example.com')
  const orgs = ctx.store.organizations
  orgs.createOrganization({ id: 'corg_contoso', name: 'Contoso', ownerId: 'usr_owner', now: Date.now() })
  orgs.registerAzureDevOps({
    org_id: 'corg_contoso',
    organization_name: 'contoso',
    instance_id: CONTOSO_ID,
    verified_at: Date.now(),
    verified_by: 'usr_owner'
  })
  await ctx.createUser('usr_oss', 'oss@example.com')
  orgs.createOrganization({ id: 'corg_open', name: 'Open', ownerId: 'usr_oss', now: Date.now() })
  orgs.registerAzureDevOps({
    org_id: 'corg_open',
    organization_name: 'open-source',
    instance_id: OPEN_ID,
    verified_at: Date.now(),
    verified_by: 'usr_oss'
  })
  const user = (id: string) => ctx.store.findUser(id) ?? expect.unreachable()
  memberAccess = issueSession(ctx.store, ctx.config, user('usr_member')).accessToken
  ownerAccess = issueSession(ctx.store, ctx.config, user('usr_owner')).accessToken
})

afterEach(() => ctx.dispose())

function link(body: unknown, access = memberAccess) {
  return ctx.app.request(LINK, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${access}` },
    body: JSON.stringify(body)
  })
}

function readLink(organizationUrl: string, access = memberAccess) {
  return ctx.app.request(`${LINK}?${new URLSearchParams({ organizationUrl })}`, {
    headers: { authorization: `Bearer ${access}` }
  })
}

const contosoPat = { organizationUrl: 'https://dev.azure.com/contoso', azureDevOpsToken: MEMBER_TOKEN, tokenKind: 'pat' }

describe('desktop Azure DevOps link', () => {
  it('connects a member of a registered AzDO org and records an azure-devops membership', async () => {
    const res = await link(contosoPat)
    expect(await res.json()).toEqual({
      status: 'connected',
      organization: { id: 'corg_contoso', name: 'Contoso' },
      azureDevOps: { organizationName: 'contoso', instanceId: CONTOSO_ID }
    })
    const member = ctx.store.organizations.listMembers('corg_contoso').find((m) => m.user_id === 'usr_member')
    expect(member).toMatchObject({ role: 'member', source: 'azure-devops' })
    expect(ctx.azure.calls[0]?.authorization).toMatch(/^Basic /)

    expect(await (await readLink('https://contoso.visualstudio.com')).json()).toMatchObject({ status: 'connected' })
  })

  it('sends a bearer token as Bearer and keeps an owner as owner', async () => {
    const res = await link({ ...contosoPat, azureDevOpsToken: OWNER_TOKEN, tokenKind: 'bearer' }, ownerAccess)
    expect(await res.json()).toMatchObject({ status: 'connected' })
    expect(ctx.azure.calls[0]?.authorization).toBe(`Bearer ${OWNER_TOKEN}`)
    const owner = ctx.store.organizations.listMembers('corg_contoso').find((m) => m.user_id === 'usr_owner')
    expect(owner).toMatchObject({ role: 'owner', source: 'web' })
  })

  it('answers not-registered when no Dolphin org claimed that AzDO org', async () => {
    const res = await link({ ...contosoPat, organizationUrl: 'https://dev.azure.com/fabrikam' })
    expect(await res.json()).toEqual({ status: 'not-registered' })
    expect(await (await readLink('https://dev.azure.com/fabrikam')).json()).toEqual({ status: 'not-linked' })
  })

  it('answers invalid-credentials for a rejected token or a sign-in redirect', async () => {
    expect(await (await link({ ...contosoPat, azureDevOpsToken: 'fake-token-unknown' })).json()).toEqual({
      status: 'invalid-credentials'
    })
    expect(await (await link({ ...contosoPat, azureDevOpsToken: SIGN_IN_REDIRECT_TOKEN })).json()).toEqual({
      status: 'invalid-credentials'
    })
    expect(ctx.store.organizations.listMembers('corg_contoso')).toHaveLength(1)
  })

  it('answers unsupported-host without calling anything', async () => {
    for (const organizationUrl of [
      'https://evil.example/contoso',
      'http://dev.azure.com/contoso',
      'https://dev.azure.com:8443/contoso',
      'https://user@dev.azure.com/contoso',
      'https://a.b.visualstudio.com'
    ]) {
      expect(await (await link({ ...contosoPat, organizationUrl })).json()).toEqual({ status: 'unsupported-host' })
    }
    expect(ctx.azure.calls).toEqual([])
  })

  it('answers 502 when Azure DevOps itself fails', async () => {
    const res = await link({ ...contosoPat, azureDevOpsToken: OUTAGE_TOKEN })
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: 'azure_devops_unavailable' })
  })

  it('rejects malformed bodies and missing Dolphin sessions', async () => {
    expect((await link({ organizationUrl: 'https://dev.azure.com/contoso' })).status).toBe(400)
    expect((await link({ ...contosoPat, tokenKind: 'cookie' })).status).toBe(400)
    expect((await link(contosoPat, 'at_not-a-session')).status).toBe(401)
    expect((await readLink('https://dev.azure.com/contoso', 'at_not-a-session')).status).toBe(401)
    expect((await readLink('https://evil.example/x')).status).toBe(400)
  })

  it('reads not-linked before the first link', async () => {
    expect(await (await readLink('https://dev.azure.com/contoso')).json()).toEqual({ status: 'not-linked' })
  })

  it('rejects the public-access identity a public org returns for non-members', async () => {
    const open = { ...contosoPat, organizationUrl: 'https://dev.azure.com/open-source' }
    for (const attempt of [
      { ...open, azureDevOpsToken: 'fake-pat-from-another-org' },
      { ...open, azureDevOpsToken: 'fake-entra-token-other-tenant', tokenKind: 'bearer' },
      { ...open, azureDevOpsToken: BUILD_SERVICE_TOKEN },
      { ...open, azureDevOpsToken: IMPERSONATED_TOKEN }
    ]) {
      expect(await (await link(attempt)).json()).toEqual({ status: 'invalid-credentials' })
    }
    expect(ctx.store.organizations.listMembers('corg_open').map((m) => m.user_id)).toEqual(['usr_oss'])
    // A real member of the same public org still links.
    expect(await (await link({ ...open, azureDevOpsToken: MEMBER_TOKEN })).json()).toMatchObject({
      status: 'connected',
      organization: { id: 'corg_open' }
    })
  })

  it('never stores the AzDO token', async () => {
    await link(contosoPat)
    await link({ ...contosoPat, azureDevOpsToken: OWNER_TOKEN, tokenKind: 'bearer' }, ownerAccess)
    const db = dumpDatabase(ctx.store)
    expect(db).toContain(MEMBER_AZDO_ID)
    expect(db).not.toContain(MEMBER_TOKEN)
    expect(db).not.toContain(OWNER_TOKEN)
  })
})
