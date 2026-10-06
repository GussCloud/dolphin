import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { AzureDevOpsIdentityStore } from './azure-devops-identity-store.js'
import { ConsoleSessionStore } from './console-session.js'
import { OfficeDisplayLinkStore } from './office-display-link-store.js'
import { OrganizationStore } from './organization-store.js'
import { hashToken } from './secrets.js'

export type UserRow = { id: string; email: string; password_hash: string; display_name: string | null }

export type SessionRow = {
  id: string
  user_id: string
  access_hash: string
  refresh_hash: string
  access_expires_at: number
  refresh_expires_at: number
  revoked: number
}

export type AuthCodeRow = {
  code_hash: string
  user_id: string
  client_id: string
  redirect_uri: string
  code_challenge: string
  nonce: string
  state: string
  local_profile_id: string
  expires_at: number
  used: number
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_codes (
  code_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  nonce TEXT NOT NULL,
  state TEXT NOT NULL,
  local_profile_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  access_hash TEXT NOT NULL UNIQUE,
  refresh_hash TEXT NOT NULL UNIQUE,
  access_expires_at INTEGER NOT NULL,
  refresh_expires_at INTEGER NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  received_at INTEGER NOT NULL,
  submission_type TEXT,
  app_version TEXT,
  platform TEXT,
  body TEXT NOT NULL
);
`

/** SQLite-backed state; small enough for one VPS and needs no native module (node:sqlite). */
export class AuthStore {
  readonly db: DatabaseSync
  readonly organizations: OrganizationStore
  readonly consoleSessions: ConsoleSessionStore
  readonly azureDevOpsIdentities: AzureDevOpsIdentityStore
  readonly officeDisplayLinks: OfficeDisplayLinkStore

  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true })
    this.db = new DatabaseSync(join(dataDir, 'dolphin-auth.sqlite'))
    this.db.exec('PRAGMA journal_mode = WAL;')
    this.db.exec(SCHEMA)
    this.organizations = new OrganizationStore(this.db)
    this.consoleSessions = new ConsoleSessionStore(this.db)
    this.azureDevOpsIdentities = new AzureDevOpsIdentityStore(this.db)
    this.officeDisplayLinks = new OfficeDisplayLinkStore(this.db)
    this.azureDevOpsIdentities.backfillFromMemberships(Date.now())
  }

  /** Runs `work` atomically; any throw rolls back every write it made. */
  transaction<T>(work: () => T): T {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const result = work()
      this.db.exec('COMMIT')
      return result
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  close(): void {
    this.db.close()
  }

  createUser(user: { id: string; email: string; passwordHash: string; displayName?: string }): void {
    this.db
      .prepare(
        'INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(user.id, user.email, user.passwordHash, user.displayName ?? null, Date.now())
  }

  setPassword(email: string, passwordHash: string): boolean {
    return (
      this.db.prepare('UPDATE users SET password_hash = ? WHERE email = ?').run(passwordHash, email)
        .changes > 0
    )
  }

  findUserByEmail(email: string): UserRow | undefined {
    return this.db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined
  }

  findUser(id: string): UserRow | undefined {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
  }

  listUsers(): (Pick<UserRow, 'id' | 'email' | 'display_name'> & { azure_devops: 'yes' | '' })[] {
    return this.db
      .prepare(
        `SELECT id, email, display_name, CASE WHEN EXISTS (SELECT 1 FROM user_azure_devops_identities i
         WHERE i.user_id = users.id) THEN 'yes' ELSE '' END AS azure_devops FROM users ORDER BY email`
      )
      .all() as (Pick<UserRow, 'id' | 'email' | 'display_name'> & { azure_devops: 'yes' | '' })[]
  }

  insertCode(row: Omit<AuthCodeRow, 'used'>): void {
    this.db
      .prepare(
        `INSERT INTO auth_codes (code_hash, user_id, client_id, redirect_uri, code_challenge, nonce,
         state, local_profile_id, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        row.code_hash,
        row.user_id,
        row.client_id,
        row.redirect_uri,
        row.code_challenge,
        row.nonce,
        row.state,
        row.local_profile_id,
        row.expires_at
      )
  }

  /** One-time: the code is marked used in the same statement that reads it. */
  consumeCode(code: string, now: number): AuthCodeRow | undefined {
    const row = this.db
      .prepare(
        'UPDATE auth_codes SET used = 1 WHERE code_hash = ? AND used = 0 AND expires_at > ? RETURNING *'
      )
      .get(hashToken(code), now) as AuthCodeRow | undefined
    return row
  }

  insertSession(row: Omit<SessionRow, 'revoked'>): void {
    this.db
      .prepare(
        `INSERT INTO sessions (id, user_id, access_hash, refresh_hash, access_expires_at,
         refresh_expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        row.id,
        row.user_id,
        row.access_hash,
        row.refresh_hash,
        row.access_expires_at,
        row.refresh_expires_at,
        Date.now()
      )
  }

  findSessionByAccess(accessToken: string, now: number): SessionRow | undefined {
    return this.db
      .prepare('SELECT * FROM sessions WHERE access_hash = ? AND revoked = 0 AND access_expires_at > ?')
      .get(hashToken(accessToken), now) as SessionRow | undefined
  }

  /** Rotation: the refresh token is revoked in the same statement that reads it. */
  consumeRefresh(refreshToken: string, now: number): SessionRow | undefined {
    return this.db
      .prepare(
        `UPDATE sessions SET revoked = 1 WHERE refresh_hash = ? AND revoked = 0
         AND refresh_expires_at > ? RETURNING *`
      )
      .get(hashToken(refreshToken), now) as SessionRow | undefined
  }

  revokeSession(id: string): void {
    this.db.prepare('UPDATE sessions SET revoked = 1 WHERE id = ?').run(id)
  }

  revokeByRefresh(refreshToken: string): void {
    this.db.prepare('UPDATE sessions SET revoked = 1 WHERE refresh_hash = ?').run(hashToken(refreshToken))
  }

  pruneExpired(now: number): void {
    this.db.prepare('DELETE FROM auth_codes WHERE expires_at < ?').run(now)
    this.db.prepare('DELETE FROM sessions WHERE refresh_expires_at < ? OR revoked = 1').run(now)
    this.consoleSessions.pruneExpired(now)
  }

  insertFeedback(row: {
    submissionType: string | null
    appVersion: string | null
    platform: string | null
    body: string
  }): void {
    this.db
      .prepare(
        'INSERT INTO feedback (received_at, submission_type, app_version, platform, body) VALUES (?, ?, ?, ?, ?)'
      )
      .run(Date.now(), row.submissionType, row.appVersion, row.platform, row.body)
  }
}
