import { hostedReviewCopy } from './hosted-review-copy'
import {
  buildMobileHostedReviewCreateParams,
  createMobileHostedReview,
  mobileRepoSelectorFromWorktreeId,
  resolveMobileHostedReviewPrefill,
  shouldPushBeforeMobileHostedReviewCreate,
  type MobileHostedReviewCreateInput,
  type MobileHostedReviewCreateOutcome,
  type MobileHostedReviewEligibilityInput,
  type MobileHostedReviewPrefill
} from './mobile-hosted-review-service'
import { sourceControlText } from './source-control-text'

export type MobilePrEligibilityInput = MobileHostedReviewEligibilityInput
export type MobilePrPrefill = MobileHostedReviewPrefill
export type MobilePrCreateInput = MobileHostedReviewCreateInput
export type MobilePrCreateOutcome = MobileHostedReviewCreateOutcome

export {
  buildMobileHostedReviewCreateParams as buildMobilePrCreateParams,
  createMobileHostedReview as createMobilePr,
  mobileRepoSelectorFromWorktreeId,
  resolveMobileHostedReviewPrefill as resolveMobilePrPrefill,
  shouldPushBeforeMobileHostedReviewCreate as shouldPushBeforeMobilePrCreate
}

export function getMobilePrCreateSuccessWarning(
  outcome: Extract<MobilePrCreateOutcome, { ok: true }>,
  provider: MobilePrPrefill['provider']
): string | undefined {
  const copy = hostedReviewCopy(provider)
  if (outcome.existing) {
    return outcome.number
      ? sourceControlText('reviewAlreadyOpenNumbered', {
          review: copy.titleLabel,
          number: outcome.number
        })
      : sourceControlText('reviewAlreadyOpen', { review: copy.titleLabel })
  }
  if (outcome.linkError) {
    return sourceControlText('reviewCreatedNotRefreshed', { review: copy.titleLabel })
  }
  return undefined
}

export function getMobilePrCreateBlockMessage(prefill: MobilePrPrefill): string | null {
  const copy = hostedReviewCopy(prefill.provider)
  if (prefill.canCreate !== false || shouldPushBeforeMobileHostedReviewCreate(prefill)) {
    // Fail closed: only an accepted no-review lookup (`not_found`) may open
    // Create / Push & Create. `unavailable`, `found`, or a missing outcome (an
    // older host that predates the field) all leave review existence unproven —
    // mobile has no refresh/review-lookup signal of its own, so it must not
    // offer create, or the needs_push Push & Create path would slip through.
    if (prefill.reviewLookupOutcome !== 'not_found') {
      return sourceControlText('reviewLookupUnconfirmed', { review: copy.reviewLabel })
    }
    return null
  }
  switch (prefill.blockedReason) {
    case 'dirty':
      return sourceControlText('blockDirty', { review: copy.reviewLabel })
    case 'detached_head':
      return sourceControlText('blockDetachedHead', { review: copy.reviewLabel })
    case 'default_branch':
      return sourceControlText('blockDefaultBranch', { review: copy.reviewLabel })
    case 'no_upstream':
      return sourceControlText('blockNoUpstream', { review: copy.reviewLabel })
    case 'needs_sync':
      return sourceControlText('blockNeedsSync', { review: copy.reviewLabel })
    case 'auth_required':
      return sourceControlText('blockAuthRequired', { review: copy.reviewLabel })
    case 'unsupported_provider':
      return sourceControlText('blockUnsupportedProvider', { review: copy.reviewLabel })
    case 'existing_review':
      return sourceControlText('blockExistingReview', { review: copy.reviewLabel })
    case 'fork_head_unsupported':
      return sourceControlText('blockForkHead', { review: copy.reviewLabel })
    case 'base_not_on_remote':
      return sourceControlText('blockBaseNotOnRemote', { review: copy.reviewLabel })
    case 'needs_push':
    case null:
    case undefined:
      return sourceControlText('reviewNotReady', { review: copy.reviewLabel })
    default:
      // Why: desktop can add blocked reasons before a long-lived mobile branch
      // catches up; remain safely blocked while preserving merge-ref typechecks.
      return sourceControlText('reviewNotReady', { review: copy.reviewLabel })
  }
}
