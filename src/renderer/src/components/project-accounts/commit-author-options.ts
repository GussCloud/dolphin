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

export function isSavedCommitAuthor(
  saved: readonly unknown[] | null | undefined,
  identity: CommitIdentity
): boolean {
  const key = commitAuthorKey(identity)
  return normalizeCommitAuthors(saved ?? []).some((entry) => commitAuthorKey(entry) === key)
}

/** Edits `previous` in place (keeps its position); appends when it was not saved yet. */
export function replaceCommitAuthor(
  saved: readonly unknown[] | null | undefined,
  previous: CommitIdentity,
  next: CommitIdentity
): CommitIdentity[] {
  const previousKey = commitAuthorKey(previous)
  const authors = normalizeCommitAuthors(saved ?? [])
  const index = authors.findIndex((entry) => commitAuthorKey(entry) === previousKey)
  if (index === -1) {
    return withCommitAuthor(authors, next)
  }
  return normalizeCommitAuthors([...authors.slice(0, index), next, ...authors.slice(index + 1)])
}

export function withoutCommitAuthor(
  saved: readonly unknown[] | null | undefined,
  identity: CommitIdentity
): CommitIdentity[] {
  const key = commitAuthorKey(identity)
  return normalizeCommitAuthors(saved ?? []).filter((entry) => commitAuthorKey(entry) !== key)
}
