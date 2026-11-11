import { normalizeCommitIdentity, type CommitIdentity } from '../source-control-account-types'

/** What `gh api user` returns for one bound login; only the fields the author suggestion uses. */
export type GhAccountProfile = {
  login: string
  name: string | null
  /** Public profile email; null when the user keeps it private. */
  email: string | null
  id: number | null
  host: string
}

/** Reads `gh api user --jq '{login,name,email,id}'` output; null for anything unusable. */
export function parseGhAccountProfile(stdout: string, host: string): GhAccountProfile | null {
  let raw: unknown
  try {
    raw = JSON.parse(stdout)
  } catch {
    return null
  }
  if (!raw || typeof raw !== 'object' || !('login' in raw) || typeof raw.login !== 'string') {
    return null
  }
  const login = raw.login.trim()
  // Why: an empty login would build a noreply address like `7+@users.noreply.github.com`.
  if (!login) {
    return null
  }
  const text = (key: 'name' | 'email'): string | null =>
    key in raw && typeof raw[key] === 'string' && raw[key].trim() ? raw[key].trim() : null
  const id =
    'id' in raw && typeof raw.id === 'number' && Number.isSafeInteger(raw.id) && raw.id > 0
      ? raw.id
      : null
  return { login, name: text('name'), email: text('email'), id, host }
}

/**
 * The commit author to suggest for a GitHub account: its public email, else the
 * private noreply address github.com links to the account (`<id>+<login>@…`).
 */
export function suggestCommitIdentityForGhProfile(
  profile: GhAccountProfile
): CommitIdentity | null {
  const name = profile.name?.trim() || profile.login
  const noreply =
    profile.host === 'github.com' && profile.id !== null
      ? `${profile.id}+${profile.login}@users.noreply.github.com`
      : null
  const email = profile.email?.trim() || noreply
  return email ? normalizeCommitIdentity({ name, email }) : null
}
