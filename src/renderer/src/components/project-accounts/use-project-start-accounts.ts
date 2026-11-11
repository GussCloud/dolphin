import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store'
import type { GhAccountBinding } from '../../../../shared/github/account-binding'
import { suggestCommitIdentityForGhProfile } from '../../../../shared/github/account-commit-identity'
import { projectAgentAccountUpdate } from '../../../../shared/worktree-agent-account'
import type { CommitIdentity } from '../../../../shared/source-control-account-types'
import {
  EMPTY_PROJECT_START_ACCOUNTS,
  type ProjectStartAccounts,
  type StartAgent
} from './project-start-accounts'

export type ProjectStartAccountsState = {
  accounts: ProjectStartAccounts
  /** Latest choices for submit callbacks that must not re-create on every pick. */
  get: () => ProjectStartAccounts
  setGhAccount: (binding: GhAccountBinding | null) => void
  setAzureDevOpsAccount: (account: { id: string; login: string } | null) => void
  setAgentAccount: (agent: StartAgent, accountId: string | null) => void
  /** A pick by the user; account changes stop replacing the author after it. */
  setCommitIdentity: (identity: CommitIdentity | null) => void
}

function savedAuthorWithEmail(email: string): CommitIdentity | null {
  const target = email.trim().toLowerCase()
  if (!target) {
    return null
  }
  return (
    useAppStore
      .getState()
      .settings?.commitAuthors?.find((author) => author.email.toLowerCase() === target) ?? null
  )
}

async function suggestForGhAccount(binding: GhAccountBinding): Promise<CommitIdentity | null> {
  const profile = await window.api.gh.accountProfile(binding).catch(() => null)
  return profile ? suggestCommitIdentityForGhProfile(profile) : null
}

/** Only the local desktop host offers these choices; any other host keeps today's add flow. */
export function useProjectStartAccounts(enabled: boolean): ProjectStartAccountsState {
  const [accounts, setAccounts] = useState<ProjectStartAccounts>(EMPTY_PROJECT_START_ACCOUNTS)
  const accountsRef = useRef(accounts)
  // Why refs written only in handlers: suggestions read the latest picks without re-rendering.
  const ghAccountRef = useRef<GhAccountBinding | null>(null)
  const azureLoginRef = useRef('')
  const identityPickedRef = useRef(false)
  const suggestionGenerationRef = useRef(0)

  useEffect(() => {
    accountsRef.current = accounts
  }, [accounts])

  useEffect(() => {
    if (!enabled) {
      suggestionGenerationRef.current++
      ghAccountRef.current = null
      azureLoginRef.current = ''
      identityPickedRef.current = false
      setAccounts(EMPTY_PROJECT_START_ACCOUNTS)
    }
  }, [enabled])

  const get = useCallback(
    () => (enabled ? accountsRef.current : EMPTY_PROJECT_START_ACCOUNTS),
    [enabled]
  )

  const applySuggestion = useCallback(async () => {
    if (identityPickedRef.current) {
      return
    }
    const generation = ++suggestionGenerationRef.current
    // Why: GitHub knows the account's name and email; Azure only matches a saved author's email.
    const binding = ghAccountRef.current
    const suggestion = binding
      ? await suggestForGhAccount(binding)
      : savedAuthorWithEmail(azureLoginRef.current)
    if (generation === suggestionGenerationRef.current && !identityPickedRef.current) {
      setAccounts((prev) => ({ ...prev, commitIdentity: suggestion }))
    }
  }, [])

  const setGhAccount = useCallback(
    (binding: GhAccountBinding | null) => {
      ghAccountRef.current = binding
      setAccounts((prev) => ({ ...prev, ghAccount: binding }))
      void applySuggestion()
    },
    [applySuggestion]
  )

  const setAzureDevOpsAccount = useCallback(
    (account: { id: string; login: string } | null) => {
      azureLoginRef.current = account?.login ?? ''
      setAccounts((prev) => ({ ...prev, azureDevOpsAccountId: account?.id ?? null }))
      void applySuggestion()
    },
    [applySuggestion]
  )

  const setAgentAccount = useCallback((agent: StartAgent, accountId: string | null) => {
    setAccounts((prev) => ({ ...prev, ...projectAgentAccountUpdate(agent, accountId) }))
  }, [])

  const setCommitIdentity = useCallback((commitIdentity: CommitIdentity | null) => {
    identityPickedRef.current = true
    suggestionGenerationRef.current++
    setAccounts((prev) => ({ ...prev, commitIdentity }))
  }, [])

  return {
    accounts: enabled ? accounts : EMPTY_PROJECT_START_ACCOUNTS,
    get,
    setGhAccount,
    setAzureDevOpsAccount,
    setAgentAccount,
    setCommitIdentity
  }
}
