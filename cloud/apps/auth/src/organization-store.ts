import type { DatabaseSync } from 'node:sqlite'
import { hashToken } from './secrets.js'

export type OrganizationRow = { id: string; name: string; created_by: string; created_at: number }

export type MemberRole = 'owner' | 'member'
export type MemberSource = 'web' | 'azure-devops'

export type MemberView = {
  user_id: string
  email: string
  display_name: string | null
  role: MemberRole
  source: MemberSource
  joined_at: number
}

export type AzureDevOpsLinkRow = {
  org_id: string
  organization_name: string
  instance_id: string
  verified_at: number
  verified_by: string
}

export type OrganizationSummary = OrganizationRow & {
  owner_email: string | null
  azure_devops_name: string | null
  member_count: number
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS organization_members (
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  source TEXT NOT NULL CHECK (source IN ('web', 'azure-devops')),
  azure_devops_user_id TEXT,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (org_id, user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS organization_members_one_owned_org
  ON organization_members (user_id) WHERE role = 'owner';
CREATE TABLE IF NOT EXISTS organization_azure_devops (
  org_id TEXT PRIMARY KEY,
  organization_name TEXT NOT NULL,
  instance_id TEXT NOT NULL UNIQUE,
  verified_at INTEGER NOT NULL,
  verified_by TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS console_invites (
  code_hash TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  used_by TEXT,
  used_at INTEGER
);
`

/** Corporate Dolphin orgs (`corg_`); the personal `org_${userId}` never lives here. */
export class OrganizationStore {
  readonly db: DatabaseSync

  constructor(db: DatabaseSync) {
    this.db = db
    this.db.exec(SCHEMA)
  }

  insertInvite(code: string, now: number): void {
    this.db.prepare('INSERT INTO console_invites (code_hash, created_at) VALUES (?, ?)').run(hashToken(code), now)
  }

  /** Single use: the invite is claimed in the same statement that checks it. */
  consumeInvite(code: string, userId: string, now: number): boolean {
    return (
      this.db
        .prepare('UPDATE console_invites SET used_by = ?, used_at = ? WHERE code_hash = ? AND used_by IS NULL')
        .run(userId, now, hashToken(code)).changes > 0
    )
  }

  createOrganization(org: { id: string; name: string; ownerId: string; now: number }): void {
    this.db
      .prepare('INSERT INTO organizations (id, name, created_by, created_at) VALUES (?, ?, ?, ?)')
      .run(org.id, org.name, org.ownerId, org.now)
    this.db
      .prepare(
        `INSERT INTO organization_members (org_id, user_id, role, source, joined_at)
         VALUES (?, ?, 'owner', 'web', ?)`
      )
      .run(org.id, org.ownerId, org.now)
  }

  findOrganization(id: string): OrganizationRow | undefined {
    return this.db.prepare('SELECT * FROM organizations WHERE id = ?').get(id) as OrganizationRow | undefined
  }

  findOwnedOrganization(userId: string): OrganizationRow | undefined {
    return this.db
      .prepare(
        `SELECT o.* FROM organizations o JOIN organization_members m ON m.org_id = o.id
         WHERE m.user_id = ? AND m.role = 'owner'`
      )
      .get(userId) as OrganizationRow | undefined
  }

  listMemberships(userId: string): OrganizationRow[] {
    return this.db
      .prepare(
        `SELECT o.* FROM organizations o JOIN organization_members m ON m.org_id = o.id
         WHERE m.user_id = ? ORDER BY o.name`
      )
      .all(userId) as OrganizationRow[]
  }

  renameOrganization(id: string, name: string): void {
    this.db.prepare('UPDATE organizations SET name = ? WHERE id = ?').run(name, id)
  }

  listMembers(orgId: string): MemberView[] {
    return this.db
      .prepare(
        `SELECT m.user_id, u.email, u.display_name, m.role, m.source, m.joined_at
         FROM organization_members m JOIN users u ON u.id = m.user_id
         WHERE m.org_id = ? ORDER BY m.role DESC, m.joined_at`
      )
      .all(orgId) as MemberView[]
  }

  findAzureDevOpsLink(orgId: string): AzureDevOpsLinkRow | undefined {
    return this.db.prepare('SELECT * FROM organization_azure_devops WHERE org_id = ?').get(orgId) as
      | AzureDevOpsLinkRow
      | undefined
  }

  findAzureDevOpsLinkByInstance(instanceId: string): AzureDevOpsLinkRow | undefined {
    return this.db.prepare('SELECT * FROM organization_azure_devops WHERE instance_id = ?').get(instanceId) as
      | AzureDevOpsLinkRow
      | undefined
  }

  /** One AzDO org belongs to at most one Dolphin org; re-verifying replaces this org's own link. */
  registerAzureDevOps(link: AzureDevOpsLinkRow): 'registered' | 'taken' {
    const existing = this.findAzureDevOpsLinkByInstance(link.instance_id)
    if (existing && existing.org_id !== link.org_id) {
      return 'taken'
    }
    this.db
      .prepare(
        `INSERT INTO organization_azure_devops (org_id, organization_name, instance_id, verified_at, verified_by)
         VALUES (?, ?, ?, ?, ?) ON CONFLICT (org_id) DO UPDATE SET organization_name = excluded.organization_name,
         instance_id = excluded.instance_id, verified_at = excluded.verified_at, verified_by = excluded.verified_by`
      )
      .run(link.org_id, link.organization_name, link.instance_id, link.verified_at, link.verified_by)
    return 'registered'
  }

  /** AzDO renames keep instanceId, so the latest verified name wins. */
  renameAzureDevOpsOrganization(instanceId: string, organizationName: string): void {
    this.db
      .prepare('UPDATE organization_azure_devops SET organization_name = ? WHERE instance_id = ?')
      .run(organizationName, instanceId)
  }

  /** Existing members keep their role and source; only the AzDO identity is refreshed. */
  recordAzureDevOpsMember(member: { orgId: string; userId: string; azureDevOpsUserId: string; now: number }): void {
    this.db
      .prepare(
        `INSERT INTO organization_members (org_id, user_id, role, source, azure_devops_user_id, joined_at)
         VALUES (?, ?, 'member', 'azure-devops', ?, ?)
         ON CONFLICT (org_id, user_id) DO UPDATE SET azure_devops_user_id = excluded.azure_devops_user_id`
      )
      .run(member.orgId, member.userId, member.azureDevOpsUserId, member.now)
  }

  findLinkedMembership(
    userId: string,
    organizationName: string
  ): { organization: OrganizationRow; link: AzureDevOpsLinkRow } | undefined {
    const link = this.db
      .prepare(
        `SELECT a.* FROM organization_azure_devops a JOIN organization_members m ON m.org_id = a.org_id
         WHERE m.user_id = ? AND a.organization_name = ?`
      )
      .get(userId, organizationName) as AzureDevOpsLinkRow | undefined
    const organization = link ? this.findOrganization(link.org_id) : undefined
    return link && organization ? { organization, link } : undefined
  }

  listOrganizations(): OrganizationSummary[] {
    return this.db
      .prepare(
        `SELECT o.*, u.email AS owner_email, a.organization_name AS azure_devops_name,
         (SELECT COUNT(*) FROM organization_members c WHERE c.org_id = o.id) AS member_count
         FROM organizations o
         LEFT JOIN organization_members m ON m.org_id = o.id AND m.role = 'owner'
         LEFT JOIN users u ON u.id = m.user_id
         LEFT JOIN organization_azure_devops a ON a.org_id = o.id
         ORDER BY o.created_at`
      )
      .all() as OrganizationSummary[]
  }
}
