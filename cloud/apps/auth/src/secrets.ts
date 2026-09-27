import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

export function randomToken(prefix: string): string {
  return `${prefix}_${randomBytes(32).toString('base64url')}`
}

/** Tokens are stored only as hashes, so a leaked database cannot be replayed. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url')
}

export function s256Challenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

const SCRYPT_KEY_LENGTH = 64

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, SCRYPT_KEY_LENGTH, { N: 16384, r: 8, p: 1 }, (error, key) =>
      error ? reject(error) : resolve(key)
    )
  })
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await scryptAsync(password, salt)
  return `scrypt$${salt.toString('base64url')}$${key.toString('base64url')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, expected] = stored.split('$')
  if (scheme !== 'scrypt' || !salt || !expected) {
    return false
  }
  const key = await scryptAsync(password, Buffer.from(salt, 'base64url'))
  const expectedKey = Buffer.from(expected, 'base64url')
  return expectedKey.length === key.length && timingSafeEqual(expectedKey, key)
}
