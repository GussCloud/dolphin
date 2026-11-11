import { useRef, useState } from 'react'
import { useAppStore } from '@/store'
import type { AzureDevOpsManagedAccount } from '../../../../shared/source-control-account-types'
import type { WorktreeAccountAgent } from '../../../../shared/worktree-agent-account'
import { addAzureDevOpsManagedAccount } from './project-account-client'
import { agentPcDefaultAccountId } from './start-account-options'

export type AddingAccount = 'azure' | WorktreeAccountAgent | null

function hostAgentAccountIds(agent: WorktreeAccountAgent): Set<string> {
  const settings = useAppStore.getState().settings
  const accounts =
    agent === 'codex' ? settings?.codexManagedAccounts : settings?.claudeManagedAccounts
  return new Set((accounts ?? []).map((account) => account.id))
}

/**
 * Sign-ins started from the add-project panel. The PC's active account never changes:
 * Codex activates a new account on add, so the previous selection is put back.
 */
export function useStartAccountAdds(handlers: {
  onAzureAdded: (account: AzureDevOpsManagedAccount) => void
  onAgentAdded: (agent: WorktreeAccountAgent, accountId: string) => void
}): {
  adding: AddingAccount
  error: string | null
  addAzure: () => Promise<void>
  addAgent: (agent: WorktreeAccountAgent) => Promise<void>
  cancel: () => void
} {
  const [adding, setAdding] = useState<AddingAccount>(null)
  const [error, setError] = useState<string | null>(null)
  const cancelledRef = useRef(false)

  const begin = (kind: AddingAccount): void => {
    cancelledRef.current = false
    setError(null)
    setAdding(kind)
  }
  const fail = (err: unknown): void => {
    // Why: a cancelled login rejects; that is the user's choice, not an error to show.
    if (!cancelledRef.current) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const addAzure = async (): Promise<void> => {
    begin('azure')
    try {
      const result = await addAzureDevOpsManagedAccount('in-app')
      if (result.ok) {
        handlers.onAzureAdded(result.account)
      } else {
        fail(new Error(result.error))
      }
    } catch (err) {
      fail(err)
    } finally {
      setAdding(null)
    }
  }

  const addAgent = async (agent: WorktreeAccountAgent): Promise<void> => {
    const before = hostAgentAccountIds(agent)
    const previousActive = agentPcDefaultAccountId(agent, useAppStore.getState().settings)
    begin(agent)
    try {
      const target = { runtime: 'host' as const, wslDistro: null }
      await (agent === 'codex'
        ? window.api.codexAccounts.add(target)
        : window.api.claudeAccounts.add(target))
      const { fetchSettings } = useAppStore.getState()
      await fetchSettings()
      const afterSettings = useAppStore.getState().settings
      if (agent === 'codex' && agentPcDefaultAccountId('codex', afterSettings) !== previousActive) {
        await window.api.codexAccounts.select({ accountId: previousActive, ...target })
        await fetchSettings()
      }
      const added = [...hostAgentAccountIds(agent)].find((id) => !before.has(id))
      if (added) {
        handlers.onAgentAdded(agent, added)
      }
    } catch (err) {
      fail(err)
    } finally {
      setAdding(null)
    }
  }

  const cancel = (): void => {
    cancelledRef.current = true
    const cancelByKind = {
      azure: () => window.api.azureDevOps.cancelCliSignIn(),
      claude: () => window.api.claudeAccounts.cancelPendingLogin(),
      codex: () => window.api.codexAccounts.cancelPendingLogin()
    }
    if (adding) {
      void cancelByKind[adding]()
    }
  }

  return { adding, error, addAzure, addAgent, cancel }
}
