import { createHash } from 'node:crypto'
import { SignJWT } from 'jose'
import type { CloudIdentity } from './session-service.js'
import type { SigningKey } from './signing-key.js'

export const RELAY_TOKEN_AUDIENCE = 'dolphin-relay'

/** The relay re-derives this at hello; issuing a token for any other id would only fail later. */
export function relayHostIdForPublicKey(hostPublicKeyB64: string): string | null {
  const key = Buffer.from(hostPublicKeyB64, 'base64')
  if (key.length !== 32) {
    return null
  }
  return createHash('sha256').update(key).digest('base64url').slice(0, 16)
}

/** Claims match cloud/apps/relay/src/relay-token-verifier.ts exactly. */
export async function signRelayToken(args: {
  key: SigningKey
  issuer: string
  identity: CloudIdentity
  relayHostId: string
  ttlSeconds: number
  nowSeconds?: number
}): Promise<{ relayToken: string; expiresAt: number }> {
  const iat = args.nowSeconds ?? Math.floor(Date.now() / 1000)
  const exp = iat + args.ttlSeconds
  const relayToken = await new SignJWT({
    prof: args.identity.cloudProfileId,
    org: args.identity.activeOrgId,
    relayHostId: args.relayHostId,
    purpose: 'host-control'
  })
    .setProtectedHeader({ alg: 'ES256', kid: args.key.kid, typ: 'JWT' })
    .setIssuer(args.issuer)
    .setAudience(RELAY_TOKEN_AUDIENCE)
    .setSubject(args.identity.userId)
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(args.key.privateKey)
  return { relayToken, expiresAt: exp * 1000 }
}
