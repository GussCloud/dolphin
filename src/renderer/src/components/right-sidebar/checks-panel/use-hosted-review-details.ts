import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { Repo } from '../../../../../shared/repo-types'
import type { HostedReviewInfo } from '../../../../../shared/hosted-review'
import type {
  HostedReviewAction,
  HostedReviewDetails
} from '../../../../../shared/hosted-review-actions'
import {
  fetchHostedReviewDetails,
  performHostedReviewAction
} from '@/lib/hosted-review-details-client'

export type HostedReviewDetailsState = {
  details: HostedReviewDetails | null
  loading: boolean
  error: string | null
  pendingAction: HostedReviewAction['kind'] | null
  reload: () => Promise<void>
  run: (action: HostedReviewAction) => Promise<boolean>
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function useHostedReviewDetails(
  repo: Repo,
  review: Pick<HostedReviewInfo, 'provider' | 'number' | 'updatedAt'>,
  onRefreshReview: () => Promise<void>
): HostedReviewDetailsState {
  const [details, setDetails] = useState<HostedReviewDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<HostedReviewAction['kind'] | null>(null)
  // Why: a slow response for a previous PR must not overwrite the one now shown.
  const requestRef = useRef(0)
  const { provider, number } = review

  const reload = useCallback(async () => {
    const requestId = ++requestRef.current
    setLoading(true)
    try {
      const next = await fetchHostedReviewDetails(repo, { provider, number })
      if (requestId === requestRef.current) {
        setDetails(next)
        setError(null)
      }
    } catch (caught) {
      if (requestId === requestRef.current) {
        setError(message(caught))
      }
    } finally {
      if (requestId === requestRef.current) {
        setLoading(false)
      }
    }
  }, [repo, provider, number])

  useEffect(() => {
    void reload()
    // `updatedAt` changes when the card poll sees a newer PR; follow it.
  }, [reload, review.updatedAt])

  const run = useCallback(
    async (action: HostedReviewAction) => {
      setPendingAction(action.kind)
      try {
        const result = await performHostedReviewAction(repo, { provider, number }, action)
        if (!result.ok) {
          toast.error(result.error)
          return false
        }
        await Promise.all([reload(), onRefreshReview()])
        return true
      } catch (caught) {
        toast.error(message(caught))
        return false
      } finally {
        setPendingAction(null)
      }
    },
    [repo, provider, number, reload, onRefreshReview]
  )

  return { details, loading, error, pendingAction, reload, run }
}
