import React from 'react'
import { useAppStore } from '@/store'
import { AgentAccountPicker } from '@/components/agent/AgentAccountPicker'
import { resolveAgentAccountPickerChoices } from '@/components/agent/agent-account-picker-choices'
import type { TuiAgent } from '../../../../shared/tui-agent'

export function ComposerAgentAccountField({
  agent,
  repoId,
  executionHostId,
  value,
  onValueChange
}: {
  agent: TuiAgent | null
  repoId: string
  executionHostId: string | null | undefined
  value: string | null
  onValueChange: (accountId: string | null) => void
}): React.JSX.Element | null {
  const settings = useAppStore((s) => s.settings)
  const repoPath = useAppStore((s) => s.repos.find((repo) => repo.id === repoId)?.path ?? null)
  const picker = resolveAgentAccountPickerChoices({ agent, executionHostId, repoPath, settings })
  if (!picker) {
    return null
  }
  return (
    <AgentAccountPicker
      agent={picker.agent}
      choices={picker.choices}
      value={value}
      onValueChange={onValueChange}
    />
  )
}
