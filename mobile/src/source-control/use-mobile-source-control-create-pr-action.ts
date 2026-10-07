import { useMemo } from 'react'
import { buildMobileCreatePrAction } from './mobile-create-pr-action'
import { useMobileHostedReviewEligibility } from './use-mobile-hosted-review-eligibility'
import type { MobileGitStatusResult } from './mobile-git-status'
import { useMobileLocale } from '../i18n/use-mobile-translation'

type Params = {
  client: Parameters<typeof useMobileHostedReviewEligibility>[0]['client']
  connState: Parameters<typeof useMobileHostedReviewEligibility>[0]['connState']
  hostId: string
  worktreeId: string
  status: MobileGitStatusResult | null
  hasUncommittedChanges: boolean
  busyAction: string | null
  createPr: (pushFirst: boolean) => void
}

export function useMobileSourceControlCreatePrAction({
  client,
  connState,
  hostId,
  worktreeId,
  status,
  hasUncommittedChanges,
  busyAction,
  createPr
}: Params) {
  const upstream = status?.upstreamStatus
  const eligibilityState = useMobileHostedReviewEligibility({
    client,
    connState,
    hostId,
    worktreeId,
    branch: status?.branch,
    hasUpstream: upstream?.hasUpstream,
    ahead: upstream?.ahead,
    behind: upstream?.behind,
    hasUncommittedChanges
  })

  // Why: the builder translates its labels, so a language change must rebuild them.
  const locale = useMobileLocale()
  return useMemo(
    () =>
      buildMobileCreatePrAction({
        branch: status?.branch,
        eligibilityState,
        busyAction,
        onCreatePr: createPr
      }),
    [busyAction, createPr, eligibilityState, locale, status?.branch]
  )
}
