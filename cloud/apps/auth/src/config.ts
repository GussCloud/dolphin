import { join } from 'node:path'

export type AuthConfig = {
  port: number
  /** Public origin of this service; also the `iss` of every relay token. */
  issuer: string
  clientId: string
  dataDir: string
  /** PEM PKCS#8 P-256 key; generated and persisted in dataDir when absent. */
  signingKeyPem: string | null
  accessTokenTtlMs: number
  refreshTokenTtlMs: number
  relayTokenTtlSeconds: number
  capabilityFlags: Record<string, boolean>
}

function requireOrigin(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is required`)
  }
  const url = new URL(value)
  const loopback = ['127.0.0.1', 'localhost'].includes(url.hostname)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    throw new Error(`${name} must be an https origin`)
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${name} must be a bare origin`)
  }
  return url.origin
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export function readAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  return {
    port: positiveInt(env.PORT, 8080),
    issuer: requireOrigin('DOLPHIN_AUTH_ISSUER', env.DOLPHIN_AUTH_ISSUER),
    clientId: env.DOLPHIN_AUTH_CLIENT_ID?.trim() || 'dolphin-desktop',
    dataDir: env.DOLPHIN_AUTH_DATA_DIR?.trim() || join(process.cwd(), 'data', 'auth'),
    signingKeyPem: env.DOLPHIN_AUTH_SIGNING_KEY_PEM?.trim() || null,
    accessTokenTtlMs: positiveInt(env.DOLPHIN_AUTH_ACCESS_TTL_SECONDS, 3600) * 1000,
    refreshTokenTtlMs: positiveInt(env.DOLPHIN_AUTH_REFRESH_TTL_DAYS, 60) * 24 * 3600 * 1000,
    relayTokenTtlSeconds: positiveInt(env.DOLPHIN_AUTH_RELAY_TOKEN_TTL_SECONDS, 3600),
    // Why only relay.use: it is the one flag the desktop reads; sharing needs a server we do not run.
    capabilityFlags: { 'relay.use': true }
  }
}
