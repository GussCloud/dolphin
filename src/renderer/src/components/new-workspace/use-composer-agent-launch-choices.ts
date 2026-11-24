import { useCallback, useState } from 'react'
import { useAppStore } from '@/store'
import { resolveSubmittedAgentAccountId } from '@/components/agent/agent-account-picker-choices'
import type { QuickSubmitOptions } from '@/hooks/composer-state/composer-submit-model'
import type { AgentPermissionPolicy } from '../../../../shared/agent-permission-policy'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { resolveSubmittedAgentPermissionPolicy } from './agent-permission-policy-availability'
import type { NewWorkspaceComposerCardProps } from './new-workspace-composer-card-props'

type AgentLaunchChoiceProps = Pick<
  NewWorkspaceComposerCardProps,
  | 'agentAccountId'
  | 'onAgentAccountIdChange'
  | 'agentPermissionPolicy'
  | 'onAgentPermissionPolicyChange'
>

/** Account pin and bypass removal policy picked in the composer, re-checked when submitted. */
export function useComposerAgentLaunchChoices(input: {
  /** False where the create path cannot persist them (folder, multi-project). */
  supported: boolean
  agent: TuiAgent | null
  repoId: string
  executionHostId: string | null | undefined
}): {
  cardProps: AgentLaunchChoiceProps
  resolveSubmitOptions: () => QuickSubmitOptions | undefined
} {
  const { supported, agent, repoId, executionHostId } = input
  const [agentAccountId, setAgentAccountId] = useState<string | null>(null)
  const [agentPermissionPolicy, setAgentPermissionPolicy] = useState<AgentPermissionPolicy | null>(
    null
  )
  const repoPath = useAppStore(
    (state) => state.repos.find((repo) => repo.id === repoId)?.path ?? null
  )
  const resolveSubmitOptions = useCallback((): QuickSubmitOptions | undefined => {
    if (!supported) {
      return undefined
    }
    const settings = useAppStore.getState().settings
    const submittedAccountId = resolveSubmittedAgentAccountId({
      agent,
      executionHostId,
      repoPath,
      settings,
      value: agentAccountId
    })
    const submittedPolicy = resolveSubmittedAgentPermissionPolicy({
      agent,
      executionHostId,
      settings,
      value: agentPermissionPolicy
    })
    if (!submittedAccountId && !submittedPolicy) {
      return undefined
    }
    return {
      ...(submittedAccountId ? { agentAccountId: submittedAccountId } : {}),
      ...(submittedPolicy ? { agentPermissionPolicy: submittedPolicy } : {})
    }
  }, [agent, agentAccountId, agentPermissionPolicy, executionHostId, repoPath, supported])
  return {
    cardProps: {
      agentAccountId,
      onAgentAccountIdChange: supported ? setAgentAccountId : undefined,
      agentPermissionPolicy,
      onAgentPermissionPolicyChange: supported ? setAgentPermissionPolicy : undefined
    },
    resolveSubmitOptions
  }
}
