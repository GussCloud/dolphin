import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { exportJWK, exportPKCS8, generateKeyPair, importPKCS8, type CryptoKey, type JWK } from 'jose'
import { createHash, createPublicKey } from 'node:crypto'

export type SigningKey = { privateKey: CryptoKey; kid: string; publicJwk: JWK }

const KEY_FILE = 'relay-signing-key.pem'

/** The ES256 key that signs relay host tokens; the relay trusts it through /.well-known/jwks.json. */
export async function loadSigningKey(dataDir: string, pem: string | null): Promise<SigningKey> {
  let pkcs8 = pem
  const path = join(dataDir, KEY_FILE)
  if (!pkcs8 && existsSync(path)) {
    pkcs8 = readFileSync(path, 'utf8')
  }
  if (!pkcs8) {
    const pair = await generateKeyPair('ES256', { extractable: true })
    pkcs8 = await exportPKCS8(pair.privateKey)
    writeFileSync(path, pkcs8, { mode: 0o600 })
  }
  const privateKey = await importPKCS8(pkcs8, 'ES256', { extractable: true })
  const jwk = await exportJWK(createPublicKey(pkcs8))
  // Why a thumbprint-style kid: rotating the key changes the kid, so the relay refetches JWKS.
  const kid = createHash('sha256').update(`${jwk.x}.${jwk.y}`).digest('base64url').slice(0, 16)
  return {
    privateKey,
    kid,
    publicJwk: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, kid, alg: 'ES256', use: 'sig' }
  }
}
