import { sourceControlText } from './source-control-text'

// Provider-aware review labels, ported from the desktop localized-copy mapping
// (src/renderer/src/i18n/hosted-review-localized-copy.ts). GitLab uses
// "Merge Request"; everything else uses "Pull Request". Keeps the mobile create
// UI provider-agnostic instead of hardcoding GitHub naming.
export type HostedReviewCopy = {
  shortLabel: string // "PR" / "MR"
  reviewLabel: string // "pull request" / "merge request"
  titleLabel: string // "Pull Request" / "Merge Request"
}

export function hostedReviewCopy(provider: string | undefined): HostedReviewCopy {
  return provider === 'gitlab'
    ? {
        shortLabel: sourceControlText('reviewShortMr'),
        reviewLabel: sourceControlText('reviewLabelMr'),
        titleLabel: sourceControlText('reviewTitleMr')
      }
    : {
        shortLabel: sourceControlText('reviewShortPr'),
        reviewLabel: sourceControlText('reviewLabelPr'),
        titleLabel: sourceControlText('reviewTitlePr')
      }
}
