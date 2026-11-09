import {
  commitAuthorKey,
  normalizeCommitAuthors,
  type CommitIdentity
} from '../../../../shared/source-control-account-types'

// Why: Radix Select rejects an empty item value, so "use the git config identity" needs a sentinel.
export const GIT_CONFIG_AUTHOR_VALUE = '__git_config_author__'

export type CommitAuthorOption = {
  value: string
  label: string
  identity: CommitIdentity
}

export function commitAuthorLabel(identity: CommitIdentity): string {
  return `${identity.name} <${identity.email}>`
}

/** Saved authors first, then authors other projects already use, then the current pick if absent. */
export function commitAuthorOptions(
  saved: readonly unknown[] | null | undefined,
  inUse: readonly (CommitIdentity | null | undefined)[],
  current: CommitIdentity | null
): CommitAuthorOption[] {
  const savedAuthors = normalizeCommitAuthors(saved ?? [])
  const seen = new Set(savedAuthors.map(commitAuthorKey))
  const extra: CommitIdentity[] = []
  for (const identity of [...inUse, current]) {
    if (identity && !seen.has(commitAuthorKey(identity))) {
      seen.add(commitAuthorKey(identity))
      extra.push(identity)
    }
  }
  extra.sort((a, b) => a.name.localeCompare(b.name) || a.email.localeCompare(b.email))
  return [...savedAuthors, ...extra].map((identity) => ({
    value: commitAuthorKey(identity),
    label: commitAuthorLabel(identity),
    identity
  }))
}

/** The saved list with `identity` appended; unchanged list when it is already there. */
export function withCommitAuthor(
  saved: readonly unknown[] | null | undefined,
  identity: CommitIdentity
): CommitIdentity[] {
  return normalizeCommitAuthors([...(saved ?? []), identity])
}
