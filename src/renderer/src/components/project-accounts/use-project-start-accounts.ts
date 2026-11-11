import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store'
import type { GhAccountBinding } from '../../../../shared/github/account-binding'
import { suggestCommitIdentityForGhProfile } from '../../../../shared/github/account-commit-identity'
import type { CommitIdentity } from '../../../../shared/source-control-account-types'
import { EMPTY_PROJECT_START_ACCOUNTS, type ProjectStartAccounts } from './project-start-accounts'

export type ProjectStartAccountsState = {
  accounts: ProjectStartAccounts
  /** Latest choices for submit callbacks that must not re-create on every pick. */
  get: () => ProjectStartAccounts
  setGhAccount: (binding: GhAccountBinding | null) => void
  setAzureDevOpsAccount: (account: { id: string; login: string } | null) => void
  setAgentAccountId: (accountId: string | null) => void
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
  accountsRef.current = accounts
  const suggestionGenerationRef = useRef(0)
  const azureLoginRef = useRef('')

  useEffect(() => {
    if (!enabled) {
      suggestionGenerationRef.current++
      setAccounts(EMPTY_PROJECT_START_ACCOUNTS)
    }
  }, [enabled])

  const get = useCallback(
    () => (enabled ? accountsRef.current : EMPTY_PROJECT_START_ACCOUNTS),
    [enabled]
  )

  const applySuggestion = useCallback(async (load: () => Promise<CommitIdentity | null>) => {
    const generation = ++suggestionGenerationRef.current
    setAccounts((prev) => ({ ...prev, suggestedIdentity: null }))
    const suggestion = await load()
    if (generation === suggestionGenerationRef.current) {
      setAccounts((prev) => ({ ...prev, suggestedIdentity: suggestion }))
    }
  }, [])

  const setGhAccount = useCallback(
    (binding: GhAccountBinding | null) => {
      setAccounts((prev) => ({ ...prev, ghAccount: binding }))
      const azureLogin = accountsRef.current.azureDevOpsAccountId ? azureLoginRef.current : ''
      void applySuggestion(async () =>
        binding ? suggestForGhAccount(binding) : savedAuthorWithEmail(azureLogin)
      )
    },
    [applySuggestion]
  )

  const setAzureDevOpsAccount = useCallback(
    (account: { id: string; login: string } | null) => {
      azureLoginRef.current = account?.login ?? ''
      setAccounts((prev) => ({ ...prev, azureDevOpsAccountId: account?.id ?? null }))
      // Why: a GitHub pick already suggested an author; Azure only fills in when none did.
      if (!accountsRef.current.ghAccount) {
        void applySuggestion(async () => (account ? savedAuthorWithEmail(account.login) : null))
      }
    },
    [applySuggestion]
  )

  const setAgentAccountId = useCallback((agentAccountId: string | null) => {
    setAccounts((prev) => ({ ...prev, agentAccountId }))
  }, [])

  return {
    accounts: enabled ? accounts : EMPTY_PROJECT_START_ACCOUNTS,
    get,
    setGhAccount,
    setAzureDevOpsAccount,
    setAgentAccountId
  }
}
