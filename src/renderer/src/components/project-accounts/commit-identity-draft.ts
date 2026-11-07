import {
  normalizeCommitIdentity,
  type CommitIdentity
} from '../../../../shared/source-control-account-types'

export type CommitIdentityDraft = { name: string; email: string }

export type CommitIdentityDraftResult =
  | { status: 'empty' }
  | { status: 'valid'; identity: CommitIdentity }
  | { status: 'incomplete' | 'invalid' }

export const EMPTY_COMMIT_IDENTITY_DRAFT: CommitIdentityDraft = { name: '', email: '' }

/** Both fields blank means "use the git config identity"; a half-filled draft is never saved. */
export function evaluateCommitIdentityDraft(draft: CommitIdentityDraft): CommitIdentityDraftResult {
  const name = draft.name.trim()
  const email = draft.email.trim()
  if (!name && !email) {
    return { status: 'empty' }
  }
  if (!name || !email) {
    return { status: 'incomplete' }
  }
  const identity = normalizeCommitIdentity({ name, email })
  return identity ? { status: 'valid', identity } : { status: 'invalid' }
}

export function commitIdentityDraftFrom(
  identity: CommitIdentity | null | undefined
): CommitIdentityDraft {
  return identity ? { name: identity.name, email: identity.email } : EMPTY_COMMIT_IDENTITY_DRAFT
}
