import { Hono, type Context } from 'hono'
import { z } from 'zod'
import { renderAuthorizePage, type AuthorizeParams } from './authorize-page.js'
import type { AuthConfig } from './config.js'
import { relayHostIdForPublicKey, signRelayToken } from './relay-token.js'
import { hashToken, randomToken, s256Challenge, verifyPassword } from './secrets.js'
import {
  capabilitiesFor,
  identityFor,
  issueSession,
  organizationsFor
} from './session-service.js'
import type { SigningKey } from './signing-key.js'
import type { AuthStore, UserRow } from './store.js'
import { feedbackRoutes } from './feedback.js'

const AUTH_CODE_TTL_MS = 5 * 60 * 1000
const B64URL = /^[A-Za-z0-9_-]{16,128}$/

const AuthorizeSchema = z.object({
  client_id: z.string(),
  response_type: z.literal('code'),
  redirect_uri: z.string(),
  state: z.string().regex(B64URL),
  nonce: z.string().regex(B64URL),
  code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  code_challenge_method: z.literal('S256'),
  local_profile_id: z.string().max(256).default('')
})

const SessionSchema = z.object({
  code: z.string().min(1).max(512),
  codeVerifier: z.string().min(43).max(128),
  nonce: z.string(),
  redirectUri: z.string(),
  state: z.string(),
  localProfileId: z.string().optional()
})

/** The desktop listens on a random loopback port; nothing else may receive a code. */
export function isAllowedRedirectUri(value: string): boolean {
  try {
    const url = new URL(value)
    return (
      url.protocol === 'http:' &&
      url.hostname === '127.0.0.1' &&
      url.port !== '' &&
      url.pathname === '/auth/callback' &&
      !url.search &&
      !url.hash
    )
  } catch {
    return false
  }
}

function redirectWith(redirectUri: string, params: Record<string, string>): string {
  const url = new URL(redirectUri)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

export function createAuthApp(deps: { store: AuthStore; config: AuthConfig; key: SigningKey }) {
  const { store, config, key } = deps
  const app = new Hono()
  const now = (): number => Date.now()

  app.get('/healthz', (c) => c.json({ ok: true }))
  app.get('/.well-known/jwks.json', (c) => c.json({ keys: [key.publicJwk] }))

  app.get('/v1/desktop/auth/authorize', (c) => {
    const parsed = AuthorizeSchema.safeParse(c.req.query())
    if (!parsed.success || parsed.data.client_id !== config.clientId) {
      return c.text('Invalid authorization request', 400)
    }
    if (!isAllowedRedirectUri(parsed.data.redirect_uri)) {
      return c.text('Invalid redirect_uri', 400)
    }
    return c.html(renderAuthorizePage(pageParams(parsed.data)))
  })

  app.post('/v1/desktop/auth/authorize', async (c) => {
    const form = await c.req.parseBody()
    const parsed = AuthorizeSchema.safeParse({
      ...Object.fromEntries(Object.entries(form).map(([k, v]) => [k, String(v)])),
      response_type: 'code',
      code_challenge_method: 'S256'
    })
    if (!parsed.success || parsed.data.client_id !== config.clientId) {
      return c.text('Invalid authorization request', 400)
    }
    const request = parsed.data
    if (!isAllowedRedirectUri(request.redirect_uri)) {
      return c.text('Invalid redirect_uri', 400)
    }
    if (form.action === 'cancel') {
      return c.redirect(redirectWith(request.redirect_uri, { error: 'access_denied', state: request.state }))
    }
    const user = store.findUserByEmail(String(form.email ?? '').trim())
    const password = String(form.password ?? '')
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return c.html(renderAuthorizePage(pageParams(request), 'Invalid email or password.'), 401)
    }
    const code = randomToken('ac')
    store.insertCode({
      code_hash: hashToken(code),
      user_id: user.id,
      client_id: request.client_id,
      redirect_uri: request.redirect_uri,
      code_challenge: request.code_challenge,
      nonce: request.nonce,
      state: request.state,
      local_profile_id: request.local_profile_id,
      expires_at: now() + AUTH_CODE_TTL_MS
    })
    return c.redirect(redirectWith(request.redirect_uri, { code, state: request.state }))
  })

  app.post('/v1/desktop/auth/session', async (c) => {
    const parsed = SessionSchema.safeParse(await readJson(c))
    if (!parsed.success) {
      return c.json({ error: 'invalid_request' }, 400)
    }
    const body = parsed.data
    const code = store.consumeCode(body.code, now())
    const valid =
      code &&
      code.client_id === config.clientId &&
      code.redirect_uri === body.redirectUri &&
      code.state === body.state &&
      code.nonce === body.nonce &&
      s256Challenge(body.codeVerifier) === code.code_challenge
    const user = valid ? store.findUser(code.user_id) : undefined
    if (!user) {
      return c.json({ error: 'invalid_grant' }, 400)
    }
    return c.json(issueSession(store, config, user))
  })

  app.post('/v1/desktop/auth/refresh', async (c) => {
    const body = z.object({ refreshToken: z.string().min(1) }).safeParse(await readJson(c))
    const session = body.success ? store.consumeRefresh(body.data.refreshToken, now()) : undefined
    const user = session ? store.findUser(session.user_id) : undefined
    if (!user) {
      return c.json({ error: 'invalid_grant' }, 401)
    }
    return c.json(issueSession(store, config, user))
  })

  const authed = (handler: (c: Context, user: UserRow, sessionId: string) => Promise<Response> | Response) =>
    async (c: Context): Promise<Response> => {
      const header = c.req.header('authorization') ?? ''
      const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
      const session = token ? store.findSessionByAccess(token, now()) : undefined
      const user = session ? store.findUser(session.user_id) : undefined
      if (!session || !user) {
        return c.json({ error: 'unauthorized' }, 401)
      }
      return await handler(c, user, session.id)
    }

  app.post(
    '/v1/desktop/auth/capabilities',
    authed((c) => c.json({ capabilities: capabilitiesFor(config, now()) }))
  )

  app.post(
    '/v1/desktop/auth/profile',
    authed((c, user, sessionId) => {
      // Why rotate: the response is a full session, and the desktop stores whatever tokens it carries.
      store.revokeSession(sessionId)
      return c.json(issueSession(store, config, user))
    })
  )

  app.post(
    '/v1/desktop/auth/org',
    authed((c, user) => {
      const cloud = identityFor(user)
      return c.json({
        cloud,
        organizations: organizationsFor(cloud),
        capabilities: capabilitiesFor(config, now())
      })
    })
  )

  app.post(
    '/v1/desktop/auth/logout',
    authed(async (c, _user, sessionId) => {
      const body = z.object({ refreshToken: z.string() }).partial().safeParse(await readJson(c))
      if (body.success && body.data.refreshToken) {
        store.revokeByRefresh(body.data.refreshToken)
      }
      store.revokeSession(sessionId)
      return c.json({})
    })
  )

  app.post(
    '/v1/desktop/auth/relay-token',
    authed(async (c, user) => {
      const body = z
        .object({ relayHostId: z.string().regex(/^[A-Za-z0-9_-]{16}$/), hostPublicKeyB64: z.string() })
        .safeParse(await readJson(c))
      if (!body.success || relayHostIdForPublicKey(body.data.hostPublicKeyB64) !== body.data.relayHostId) {
        return c.json({ error: 'invalid_request' }, 400)
      }
      return c.json(
        await signRelayToken({
          key,
          issuer: config.issuer,
          identity: identityFor(user),
          relayHostId: body.data.relayHostId,
          ttlSeconds: config.relayTokenTtlSeconds
        })
      )
    })
  )

  app.route('/', feedbackRoutes(store))
  return app
}

function pageParams(request: z.infer<typeof AuthorizeSchema>): AuthorizeParams {
  return {
    client_id: request.client_id,
    redirect_uri: request.redirect_uri,
    state: request.state,
    nonce: request.nonce,
    code_challenge: request.code_challenge,
    local_profile_id: request.local_profile_id
  }
}

async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json()
  } catch {
    return null
  }
}
