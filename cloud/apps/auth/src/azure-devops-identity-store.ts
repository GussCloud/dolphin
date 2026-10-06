import type { DatabaseSync } from 'node:sqlite'

/** Stored instead of a scrypt hash: `verifyPassword` rejects any non-scrypt value, so these users have no password. */
export const AZURE_DEVOPS_ONLY_PASSWORD = 'azure-devops-only'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS user_azure_devops_identities (
  azure_devops_user_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS user_azure_devops_identities_user ON user_azure_devops_identities (user_id);
`

export type AzureDevOpsIdentityBinding = {
  azureDevOpsUserId: string
  userId: string
  email: string | null
  now: number
}

/** One Azure DevOps identity (authenticatedUser.id) signs in as exactly one Dolphin user, forever. */
export class AzureDevOpsIdentityStore {
  readonly db: DatabaseSync

  constructor(db: DatabaseSync) {
    this.db = db
    this.db.exec(SCHEMA)
  }

  findUserId(azureDevOpsUserId: string): string | undefined {
    const row = this.db
      .prepare('SELECT user_id FROM user_azure_devops_identities WHERE azure_devops_user_id = ?')
      .get(azureDevOpsUserId) as { user_id: string } | undefined
    return row?.user_id
  }

  /** Never rebinds: the primary key decides, and the existing owner is reported on conflict. */
  bind(binding: AzureDevOpsIdentityBinding): { status: 'bound' | 'already-bound' | 'bound-to-other'; userId: string } {
    const inserted = this.db
      .prepare(
        `INSERT INTO user_azure_devops_identities (azure_devops_user_id, user_id, email, created_at)
         VALUES (?, ?, ?, ?) ON CONFLICT (azure_devops_user_id) DO NOTHING`
      )
      .run(binding.azureDevOpsUserId, binding.userId, binding.email, binding.now)
    if (inserted.changes > 0) {
      return { status: 'bound', userId: binding.userId }
    }
    const owner = this.findUserId(binding.azureDevOpsUserId) ?? binding.userId
    return { status: owner === binding.userId ? 'already-bound' : 'bound-to-other', userId: owner }
  }
}
