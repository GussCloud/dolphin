import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash, randomBytes } from 'node:crypto'
import { createLocalJWKSet, jwtVerify, type JSONWebKeySet } from 'jose'
import nacl from 'tweetnacl'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { createAuthApp, isAllowedRedirectUri } from './app.js'
import { readAuthConfig } from './config.js'
import { hashPassword } from './secrets.js'
import { loadSigningKey } from './signing-key.js'
import { AuthStore } from './store.js'

const ISSUER = 'https://auth.dolphin.example'
const REDIRECT = 'http://127.0.0.1:51234/auth/callback'
// Mirrors cloud/apps/relay/src/relay-token-verifier.ts.
const RelayClaims = z.object({
  sub: z.string().min(1),
  prof: z.string().min(1),
  org: z.string().min(1).optional(),
  relayHostId: z.string().regex(/^[A-Za-z0-9_-]{16}$/),
  purpose: z.literal('host-control'),
  exp: z.number().int().positive()
})

let dataDir: string
let app: ReturnType<typeof createAuthApp>

beforeEach(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'dolphin-auth-'))
  const config = readAuthConfig({ DOLPHIN_AUTH_ISSUER: ISSUER, DOLPHIN_AUTH_DATA_DIR: dataDir })
  const store = new AuthStore(dataDir)
  store.createUser({
    id: 'usr_1',
    email: 'dev@example.com',
    passwordHash: await hashPassword('correct horse battery')
  })
  app = createAuthApp({ store, config, key: await loadSigningKey(dataDir, null) })
})

afterEach(() => rmSync(dataDir, { recursive: true, force: true }))

function pkce() {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge, state: randomBytes(32).toString('base64url'), nonce: randomBytes(32).toString('base64url') }
}

async function login(p = pkce(), password = 'correct horse battery') {
  const form = new URLSearchParams({
    client_id: 'dolphin-desktop',
    redirect_uri: REDIRECT,
    state: p.state,
    nonce: p.nonce,
    code_challenge: p.challenge,
    local_profile_id: 'local-1',
    email: 'dev@example.com',
    password,
    action: 'login'
  })
  const res = await app.request('/v1/desktop/auth/authorize', { method: 'POST', body: form })
  return { res, p }
}

async function signIn() {
  const { res, p } = await login()
  const location = new URL(res.headers.get('location') ?? '')
  const session = await app.request('/v1/desktop/auth/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      code: location.searchParams.get('code'),
      codeVerifier: p.verifier,
      nonce: p.nonce,
      redirectUri: REDIRECT,
      state: p.state,
      localProfileId: 'local-1'
    })
  })
  return (await session.json()) as {
    accessToken: string
    refreshToken: string
    expiresAt: number
    cloud: { userId: string; cloudProfileId: string; activeOrgId: string }
    capabilities: { flags: Record<string, boolean> }
  }
}

function post(path: string, body: unknown, accessToken?: string) {
  return app.request(path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {})
    },
    body: JSON.stringify(body)
  })
}

describe('desktop sign-in', () => {
  it('serves the sign-in page only for the desktop client and a loopback callback', async () => {
    const p = pkce()
    const query = (redirect: string, client = 'dolphin-desktop') =>
      `/v1/desktop/auth/authorize?${new URLSearchParams({
        client_id: client,
        response_type: 'code',
        redirect_uri: redirect,
        state: p.state,
        nonce: p.nonce,
        code_challenge: p.challenge,
        code_challenge_method: 'S256'
      })}`
    expect((await app.request(query(REDIRECT))).status).toBe(200)
    expect((await app.request(query('https://evil.example/auth/callback'))).status).toBe(400)
    expect((await app.request(query(REDIRECT, 'other'))).status).toBe(400)
  })

  it('redirects with a code and state, then exchanges it once for a session', async () => {
    const { res, p } = await login()
    expect(res.status).toBe(302)
    const location = new URL(res.headers.get('location') ?? '')
    expect(location.searchParams.get('state')).toBe(p.state)
    const body = {
      code: location.searchParams.get('code'),
      codeVerifier: p.verifier,
      nonce: p.nonce,
      redirectUri: REDIRECT,
      state: p.state
    }
    const first = await post('/v1/desktop/auth/session', body)
    const session = (await first.json()) as Record<string, unknown>
    expect(first.status).toBe(200)
    expect(session).toMatchObject({
      cloud: { userId: 'usr_1', cloudProfileId: 'prof_usr_1', email: 'dev@example.com' },
      capabilities: { flags: { 'relay.use': true } }
    })
    expect(typeof session.expiresAt).toBe('number')
    expect((await post('/v1/desktop/auth/session', body)).status).toBe(400)
  })

  it('rejects a wrong password and a PKCE verifier that does not match', async () => {
    expect((await login(pkce(), 'wrong password!!')).res.status).toBe(401)
    const { res, p } = await login()
    const code = new URL(res.headers.get('location') ?? '').searchParams.get('code')
    const bad = await post('/v1/desktop/auth/session', {
      code,
      codeVerifier: randomBytes(32).toString('base64url'),
      nonce: p.nonce,
      redirectUri: REDIRECT,
      state: p.state
    })
    expect(bad.status).toBe(400)
  })

  it('rotates refresh tokens and refuses a reused one', async () => {
    const session = await signIn()
    const refreshed = await post('/v1/desktop/auth/refresh', { refreshToken: session.refreshToken })
    expect(refreshed.status).toBe(200)
    const next = (await refreshed.json()) as { refreshToken: string; cloud: { userId: string } }
    expect(next.refreshToken).not.toBe(session.refreshToken)
    expect(next.cloud.userId).toBe(session.cloud.userId)
    expect((await post('/v1/desktop/auth/refresh', { refreshToken: session.refreshToken })).status).toBe(401)
  })

  it('answers capabilities and org for a bearer token, and 401 after logout', async () => {
    const session = await signIn()
    const caps = await post('/v1/desktop/auth/capabilities', {}, session.accessToken)
    expect(await caps.json()).toMatchObject({ capabilities: { flags: { 'relay.use': true } } })
    const org = await post('/v1/desktop/auth/org', { orgId: session.cloud.activeOrgId }, session.accessToken)
    expect(await org.json()).toMatchObject({ cloud: { activeOrgId: session.cloud.activeOrgId } })
    expect((await post('/v1/desktop/auth/logout', { refreshToken: session.refreshToken }, session.accessToken)).status).toBe(200)
    expect((await post('/v1/desktop/auth/capabilities', {}, session.accessToken)).status).toBe(401)
  })
})

describe('relay host tokens', () => {
  it('issues an ES256 token the relay verifier accepts through the published JWKS', async () => {
    const session = await signIn()
    const hostKey = nacl.box.keyPair().publicKey
    const relayHostId = createHash('sha256').update(hostKey).digest('base64url').slice(0, 16)
    const res = await post(
      '/v1/desktop/auth/relay-token',
      { relayHostId, hostPublicKeyB64: Buffer.from(hostKey).toString('base64') },
      session.accessToken
    )
    const body = (await res.json()) as { relayToken: string; expiresAt: number }
    expect(Object.keys(body).sort()).toEqual(['expiresAt', 'relayToken'])

    const jwks = (await (await app.request('/.well-known/jwks.json')).json()) as JSONWebKeySet
    const { payload } = await jwtVerify(body.relayToken, createLocalJWKSet(jwks), {
      issuer: ISSUER,
      audience: 'dolphin-relay',
      algorithms: ['ES256']
    })
    const claims = RelayClaims.parse(payload)
    expect(claims).toMatchObject({
      sub: session.cloud.userId,
      prof: session.cloud.cloudProfileId,
      org: session.cloud.activeOrgId,
      relayHostId
    })
    expect(body.expiresAt).toBe(claims.exp * 1000)
  })

  it('refuses a relayHostId that does not derive from the host key', async () => {
    const session = await signIn()
    const hostKey = nacl.box.keyPair().publicKey
    const res = await post(
      '/v1/desktop/auth/relay-token',
      { relayHostId: 'AAAAAAAAAAAAAAAA', hostPublicKeyB64: Buffer.from(hostKey).toString('base64') },
      session.accessToken
    )
    expect(res.status).toBe(400)
  })
})

describe('feedback', () => {
  it('stores JSON feedback and answers the shape the desktop reads', async () => {
    const res = await post('/v1/feedback', { feedback: 'Works great', submissionType: 'feedback', appVersion: '0.1.2' })
    expect(await res.json()).toEqual({ ok: true, imagesDelivered: true })
  })
})

describe('isAllowedRedirectUri', () => {
  it('accepts only the desktop loopback callback', () => {
    expect(isAllowedRedirectUri('http://127.0.0.1:1/auth/callback')).toBe(true)
    expect(isAllowedRedirectUri('http://localhost:1/auth/callback')).toBe(false)
    expect(isAllowedRedirectUri('http://127.0.0.1/auth/callback')).toBe(false)
    expect(isAllowedRedirectUri('http://127.0.0.1:1/other')).toBe(false)
  })
})
