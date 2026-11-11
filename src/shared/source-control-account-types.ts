/**
 * Per-project source-control account and commit identity.
 *
 * GitHub accounts live in the gh CLI (`Repo.ghAccount`); Azure DevOps accounts are
 * Dolphin records, each with its own Azure CLI config dir so logins never collide.
 */

import { normalizeGhAccountBinding, type GhAccountBinding } from './github/account-binding'

/** A Dolphin-managed Azure DevOps sign-in; the token stays in that account's Azure CLI dir. */
export type AzureDevOpsManagedAccount = {
  id: string
  /** Signed-in user principal as reported by `az account show`; display only. */
  login: string
  /** Directory name under the app's Azure DevOps accounts root; never a full path. */
  configDirName: string
  createdAt: number
}

/** Author/committer applied to commits Dolphin and the project's terminals create. */
export type CommitIdentity = {
  name: string
  email: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+$/

export function normalizeCommitIdentity(value: unknown): CommitIdentity | null {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const nameRaw = 'name' in value ? value.name : undefined
  const emailRaw = 'email' in value ? value.email : undefined
  if (typeof nameRaw !== 'string' || typeof emailRaw !== 'string') {
    return null
  }
  const name = nameRaw.trim()
  const email = emailRaw.trim()
  // Why: these reach `git -c user.name=…`; a newline or NUL would forge extra config.
  if (!name || !email || /[\r\n\0]/.test(name + email) || !EMAIL_RE.test(email)) {
    return null
  }
  return { name, email }
}

export const MAX_COMMIT_AUTHORS = 50

/** Same author when the name matches exactly and the email matches ignoring case. */
export function commitAuthorKey(identity: CommitIdentity): string {
  return `${identity.name}\0${identity.email.toLowerCase()}`
}

/** Valid, de-duplicated, bounded list for the `commitAuthors` setting; order is kept. */
export function normalizeCommitAuthors(value: unknown): CommitIdentity[] {
  if (!Array.isArray(value)) {
    return []
  }
  const seen = new Set<string>()
  const authors: CommitIdentity[] = []
  for (const entry of value) {
    const identity = normalizeCommitIdentity(entry)
    if (!identity || seen.has(commitAuthorKey(identity))) {
      continue
    }
    seen.add(commitAuthorKey(identity))
    authors.push(identity)
    if (authors.length >= MAX_COMMIT_AUTHORS) {
      break
    }
  }
  return authors
}

const ACCOUNT_ID_RE = /^[A-Za-z0-9_-]{1,64}$/

/** Account ids double as directory names, so only path-safe tokens are accepted. */
export function normalizeAzureDevOpsAccountId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const id = value.trim()
  return ACCOUNT_ID_RE.test(id) ? id : null
}

export function normalizeAzureDevOpsManagedAccounts(value: unknown): AzureDevOpsManagedAccount[] {
  if (!Array.isArray(value)) {
    return []
  }
  const seen = new Set<string>()
  const accounts: AzureDevOpsManagedAccount[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      continue
    }
    const id = normalizeAzureDevOpsAccountId('id' in entry ? entry.id : undefined)
    const configDirName = normalizeAzureDevOpsAccountId(
      'configDirName' in entry ? entry.configDirName : undefined
    )
    const login = 'login' in entry && typeof entry.login === 'string' ? entry.login.trim() : ''
    const createdAt = 'createdAt' in entry ? entry.createdAt : undefined
    if (!id || !configDirName || seen.has(id)) {
      continue
    }
    seen.add(id)
    accounts.push({
      id,
      login,
      configDirName,
      createdAt: typeof createdAt === 'number' && Number.isFinite(createdAt) ? createdAt : 0
    })
  }
  return accounts
}

const AGENT_ACCOUNT_ID_RE = /^[A-Za-z0-9_.:-]{1,256}$/

/** A managed Claude/Codex account id (`randomUUID()` today); same bound as the worktree pin. */
export function normalizeAgentAccountId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const id = value.trim()
  return AGENT_ACCOUNT_ID_RE.test(id) ? id : null
}

/** Account choices a project can receive when it is added, cloned, created, or imported. */
export type RepoAccountBinding = {
  ghAccount?: GhAccountBinding
  azureDevOpsAccountId?: string
  commitIdentity?: CommitIdentity
  /** Default managed Claude account for the project's launches; a worktree pin wins over it. */
  claudeAccountId?: string
  /** Default managed Codex account for the project's launches; a worktree pin wins over it. */
  codexAccountId?: string
}

/** Keeps only valid fields; returns undefined when nothing usable remains. */
export function normalizeRepoAccountBinding(value: unknown): RepoAccountBinding | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }
  const ghAccount = normalizeGhAccountBinding('ghAccount' in value ? value.ghAccount : undefined)
  const azureDevOpsAccountId = normalizeAzureDevOpsAccountId(
    'azureDevOpsAccountId' in value ? value.azureDevOpsAccountId : undefined
  )
  const commitIdentity = normalizeCommitIdentity(
    'commitIdentity' in value ? value.commitIdentity : undefined
  )
  const claudeAccountId = normalizeAgentAccountId(
    'claudeAccountId' in value ? value.claudeAccountId : undefined
  )
  const codexAccountId = normalizeAgentAccountId(
    'codexAccountId' in value ? value.codexAccountId : undefined
  )
  const binding: RepoAccountBinding = {
    ...(ghAccount ? { ghAccount } : {}),
    ...(azureDevOpsAccountId ? { azureDevOpsAccountId } : {}),
    ...(commitIdentity ? { commitIdentity } : {}),
    ...(claudeAccountId ? { claudeAccountId } : {}),
    ...(codexAccountId ? { codexAccountId } : {})
  }
  return Object.keys(binding).length > 0 ? binding : undefined
}
