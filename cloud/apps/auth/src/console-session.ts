import type { DatabaseSync } from 'node:sqlite'
import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { hashToken, randomToken } from './secrets.js'

export const CONSOLE_PATH = '/console'
const SESSION_COOKIE = 'dolphin_console'
// Double-submit token for forms shown before sign-in (login, signup).
const PRE_SESSION_COOKIE = 'dolphin_console_csrf'
const SESSION_TTL_MS = 12 * 3600 * 1000

export type ConsoleSessionRow = { token_hash: string; user_id: string; csrf_token: string; expires_at: number }

const SCHEMA = `
CREATE TABLE IF NOT EXISTS console_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  csrf_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
`

/** Web console sign-ins; separate from desktop sessions so neither token works for the other. */
export class ConsoleSessionStore {
  readonly db: DatabaseSync

  constructor(db: DatabaseSync) {
    this.db = db
    this.db.exec(SCHEMA)
  }

  create(userId: string, now: number): string {
    const token = randomToken('cs')
    this.db
      .prepare('INSERT INTO console_sessions (token_hash, user_id, csrf_token, expires_at) VALUES (?, ?, ?, ?)')
      .run(hashToken(token), userId, randomToken('csrf'), now + SESSION_TTL_MS)
    return token
  }

  find(token: string, now: number): ConsoleSessionRow | undefined {
    return this.db
      .prepare('SELECT * FROM console_sessions WHERE token_hash = ? AND expires_at > ?')
      .get(hashToken(token), now) as ConsoleSessionRow | undefined
  }

  /** For long-lived streams that keep only the hash, never the raw cookie. */
  findByHash(tokenHash: string, now: number): ConsoleSessionRow | undefined {
    return this.db
      .prepare('SELECT * FROM console_sessions WHERE token_hash = ? AND expires_at > ?')
      .get(tokenHash, now) as ConsoleSessionRow | undefined
  }

  revoke(token: string): void {
    this.db.prepare('DELETE FROM console_sessions WHERE token_hash = ?').run(hashToken(token))
  }

  pruneExpired(now: number): void {
    this.db.prepare('DELETE FROM console_sessions WHERE expires_at < ?').run(now)
  }
}

export function consoleCookies(secure: boolean) {
  const options = { path: CONSOLE_PATH, httpOnly: true, secure, sameSite: 'Lax' } as const
  return {
    readSession: (c: Context): string | undefined => getCookie(c, SESSION_COOKIE),
    writeSession: (c: Context, token: string): void => {
      setCookie(c, SESSION_COOKIE, token, { ...options, maxAge: SESSION_TTL_MS / 1000 })
      deleteCookie(c, PRE_SESSION_COOKIE, options)
    },
    clearSession: (c: Context): void => {
      deleteCookie(c, SESSION_COOKIE, options)
    },
    readPreSession: (c: Context): string | undefined => getCookie(c, PRE_SESSION_COOKIE),
    /** Reuses the visitor's pre-session token so two open tabs keep working. */
    ensurePreSession: (c: Context): string => {
      const existing = getCookie(c, PRE_SESSION_COOKIE)
      if (existing) {
        return existing
      }
      const token = randomToken('pre')
      setCookie(c, PRE_SESSION_COOKIE, token, options)
      return token
    }
  }
}
