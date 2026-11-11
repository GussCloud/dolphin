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
