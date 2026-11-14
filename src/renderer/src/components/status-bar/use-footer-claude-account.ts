import { useEffect, useMemo, useRef } from 'react'
import { useAppStore } from '@/store'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import {
  FOOTER_ACCOUNT_USAGE_MAX_AGE_MS,
  resolveFooterClaudeAccount,
  shouldFetchProjectAccountUsage,
  type FooterClaudeAccount
} from './footer-claude-account'

/** The Claude account of the selected workspace; fetches its usage once when the user switches to it. */
export function useFooterClaudeAccount(): FooterClaudeAccount {
  const settings = useAppStore((s) => s.settings)
  const activeWorktreeId = useAppStore((s) => s.activeWorktreeId)
  const activeRepoId = useAppStore((s) => s.activeRepoId)
  const worktree = useAppStore((s) =>
    s.activeWorktreeId ? (findWorktreeById(s.worktreesByRepo, s.activeWorktreeId) ?? null) : null
  )
  const repo = useAppStore((s) => s.repos.find((entry) => entry.id === s.activeRepoId) ?? null)
  const inactive = useAppStore((s) => s.rateLimits.inactiveClaudeAccounts)
  const fetchInactiveClaudeAccountUsage = useAppStore((s) => s.fetchInactiveClaudeAccountUsage)
  const lastAttemptRef = useRef(new Map<string, number>())

  const account = useMemo(
    () => resolveFooterClaudeAccount({ settings, worktree, repo }),
    [settings, worktree, repo]
  )

  // Why refs: usage pushes and settings writes must not retrigger the fetch, only a selection change.
  const inactiveRef = useRef(inactive)
  const accountRef = useRef(account)
  useEffect(() => {
    inactiveRef.current = inactive
    accountRef.current = account
  })

  const { accountId, fromProject } = account
  useEffect(() => {
    const now = Date.now()
    const current = accountRef.current
    if (!accountId || !shouldFetchProjectAccountUsage(inactiveRef.current, current, now)) {
      return
    }
    // Why: an account with no background usage (a linked folder) would refetch on every switch.
    const lastAttempt = lastAttemptRef.current.get(accountId) ?? 0
    if (now - lastAttempt < FOOTER_ACCOUNT_USAGE_MAX_AGE_MS) {
      return
    }
    lastAttemptRef.current.set(accountId, now)
    void fetchInactiveClaudeAccountUsage()
  }, [accountId, fromProject, activeWorktreeId, activeRepoId, fetchInactiveClaudeAccountUsage])

  return account
}
