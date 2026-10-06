import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { hashToken, randomToken } from './secrets.js'

export type OfficeDisplayLinkRow = {
  id: string
  org_id: string
  label: string
  created_by: string
  created_at: number
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS office_display_links (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER
);
`

/** Sign-in-free links that let a wall display watch one org's work view; only the token hash is kept. */
export class OfficeDisplayLinkStore {
  readonly db: DatabaseSync

  constructor(db: DatabaseSync) {
    this.db = db
    this.db.exec(SCHEMA)
  }

  /** Returns the raw token; it is never readable again. */
  create(link: { orgId: string; label: string; createdBy: string; now: number }): string {
    const token = randomToken('tv')
    this.db
      .prepare(
        `INSERT INTO office_display_links (id, org_id, token_hash, label, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(`odl_${randomUUID().replaceAll('-', '')}`, link.orgId, hashToken(token), link.label, link.createdBy, link.now)
    return token
  }

  listActive(orgId: string): OfficeDisplayLinkRow[] {
    return this.db
      .prepare(
        `SELECT id, org_id, label, created_by, created_at FROM office_display_links
         WHERE org_id = ? AND revoked_at IS NULL ORDER BY created_at`
      )
      .all(orgId) as OfficeDisplayLinkRow[]
  }

  revoke(orgId: string, id: string, now: number): boolean {
    return (
      this.db
        .prepare('UPDATE office_display_links SET revoked_at = ? WHERE id = ? AND org_id = ? AND revoked_at IS NULL')
        .run(now, id, orgId).changes > 0
    )
  }

  findOrgIdByToken(token: string): string | undefined {
    const row = this.db
      .prepare('SELECT org_id FROM office_display_links WHERE token_hash = ? AND revoked_at IS NULL')
      .get(hashToken(token)) as { org_id: string } | undefined
    return row?.org_id
  }
}
