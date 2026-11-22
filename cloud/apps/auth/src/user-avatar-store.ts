import type { DatabaseSync } from 'node:sqlite'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS user_avatars (
  user_id TEXT PRIMARY KEY,
  source TEXT CHECK (source IN ('initials', 'github', 'azure-devops')),
  github_login TEXT,
  azure_devops_image BLOB,
  azure_devops_type TEXT,
  azure_devops_updated_at INTEGER,
  updated_at INTEGER NOT NULL
);
`

export type AvatarSource = 'initials' | 'github' | 'azure-devops'

type AvatarRow = {
  user_id: string
  source: AvatarSource | null
  github_login: string | null
  azure_devops_image: Uint8Array | null
  azure_devops_type: string | null
  azure_devops_updated_at: number | null
  updated_at: number
}

/** What the console shows for a user; `version` changes whenever the picture does. */
export type ResolvedAvatar =
  | { kind: 'initials' }
  | { kind: 'github'; login: string; version: number }
  | { kind: 'azure-devops'; image: Uint8Array; type: string; version: number }

export type AvatarSettings = {
  /** null: never chosen, so the Azure DevOps picture wins when there is one. */
  source: AvatarSource | null
  githubLogin: string | null
  hasAzureDevOpsImage: boolean
}

// GitHub's own rule: 1–39 letters, digits or single inner hyphens.
export const GITHUB_LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/

/** Profile pictures for the work view: the user's choice plus the last Azure DevOps picture captured at sign-in. */
export class UserAvatarStore {
  readonly db: DatabaseSync

  constructor(db: DatabaseSync) {
    this.db = db
    this.db.exec(SCHEMA)
  }

  private row(userId: string): AvatarRow | undefined {
    return this.db.prepare('SELECT * FROM user_avatars WHERE user_id = ?').get(userId) as AvatarRow | undefined
  }

  settings(userId: string): AvatarSettings {
    const row = this.row(userId)
    return {
      source: row?.source ?? null,
      githubLogin: row?.github_login ?? null,
      hasAzureDevOpsImage: Boolean(row?.azure_devops_image)
    }
  }

  resolve(userId: string): ResolvedAvatar {
    const row = this.row(userId)
    if (!row) {
      return { kind: 'initials' }
    }
    const devops =
      row.azure_devops_image && row.azure_devops_type
        ? ({ kind: 'azure-devops', image: row.azure_devops_image, type: row.azure_devops_type, version: row.azure_devops_updated_at ?? row.updated_at } as const)
        : undefined
    if (row.source === 'github' && row.github_login) {
      return { kind: 'github', login: row.github_login, version: row.updated_at }
    }
    if ((row.source === 'azure-devops' || row.source === null) && devops) {
      return devops
    }
    return { kind: 'initials' }
  }

  choose(userId: string, choice: { source: 'initials' } | { source: 'azure-devops' } | { source: 'github'; login: string }, now: number): void {
    const login = choice.source === 'github' ? choice.login : null
    this.db
      .prepare(
        `INSERT INTO user_avatars (user_id, source, github_login, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (user_id) DO UPDATE SET source = excluded.source,
           github_login = COALESCE(excluded.github_login, user_avatars.github_login), updated_at = excluded.updated_at`
      )
      .run(userId, choice.source, login, now)
  }

  saveAzureDevOpsImage(userId: string, image: Uint8Array, type: string, now: number): void {
    this.db
      .prepare(
        `INSERT INTO user_avatars (user_id, azure_devops_image, azure_devops_type, azure_devops_updated_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (user_id) DO UPDATE SET azure_devops_image = excluded.azure_devops_image,
           azure_devops_type = excluded.azure_devops_type, azure_devops_updated_at = excluded.azure_devops_updated_at`
      )
      .run(userId, image, type, now, now)
  }
}
