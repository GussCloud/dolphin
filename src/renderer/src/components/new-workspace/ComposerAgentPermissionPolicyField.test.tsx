// @vitest-environment happy-dom

import React, { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentPermissionPolicy } from '../../../../shared/agent-permission-policy'

type FakeSettings = {
  agentDefaultArgs: Record<string, string>
  terminalWindowsShell: undefined
  activeRuntimeEnvironmentId: string | null
}

const storeState = vi.hoisted(() => {
  const settings: FakeSettings = {
    agentDefaultArgs: {},
    terminalWindowsShell: undefined,
    activeRuntimeEnvironmentId: null
  }
  return { settings }
})

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(values?.[name] ?? ''))
}))

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: typeof storeState) => unknown) => selector(storeState)
}))

// Why: Radix Select portals and pointer-captures; a native select exercises the same value contract.
vi.mock('@/components/ui/select', () => {
  const SelectContext = React.createContext<{
    value: string
    onValueChange: (value: string) => void
  } | null>(null)
  return {
    Select: ({
      value,
      onValueChange,
      children
    }: {
      value: string
      onValueChange: (value: string) => void
      children: React.ReactNode
    }) => {
      const context = React.useMemo(() => ({ value, onValueChange }), [value, onValueChange])
      return <SelectContext.Provider value={context}>{children}</SelectContext.Provider>
    },
    SelectTrigger: () => null,
    SelectValue: () => null,
    SelectContent: ({ children }: { children: React.ReactNode }) => {
      const context = React.useContext(SelectContext)!
      return (
        <select
          aria-label="policy"
          value={context.value}
          onChange={(event) => context.onValueChange(event.target.value)}
        >
          {children}
        </select>
      )
    },
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
      <option value={value}>{children}</option>
    )
  }
})

import { ComposerAgentPermissionPolicyField } from './ComposerAgentPermissionPolicyField'

function Harness({
  agent = 'claude',
  executionHostId = 'local',
  initial = null,
  onChange
}: {
  agent?: React.ComponentProps<typeof ComposerAgentPermissionPolicyField>['agent']
  executionHostId?: string
  initial?: AgentPermissionPolicy | null
  onChange?: (next: AgentPermissionPolicy | null) => void
}): React.JSX.Element {
  const [value, setValue] = useState(initial)
  return (
    <ComposerAgentPermissionPolicyField
      agent={agent}
      executionHostId={executionHostId}
      value={value}
      onValueChange={(next) => {
        setValue(next)
        onChange?.(next)
      }}
    />
  )
}

function policySelect(): HTMLSelectElement {
  const select = screen.getByLabelText('policy')
  if (!(select instanceof HTMLSelectElement)) {
    throw new Error('expected the native select stand-in')
  }
  return select
}

afterEach(() => {
  cleanup()
  storeState.settings.agentDefaultArgs = {}
  storeState.settings.activeRuntimeEnvironmentId = null
})

describe('ComposerAgentPermissionPolicyField', () => {
  it('defaults to always ask for a Claude agent launched in bypass', () => {
    render(<Harness />)
    expect(policySelect().value).toBe('ask')
    expect(screen.getByText(/Dolphin approves nothing on its own/)).toBeTruthy()
  })

  it.each(['claude-agent-teams', 'deepseek', 'deepseek-agent-teams'] as const)(
    'is offered for %s',
    (agent) => {
      render(<Harness agent={agent} />)
      expect(screen.queryByLabelText('policy')).not.toBeNull()
    }
  )

  it('stays hidden when the agent does not launch Claude in bypass', () => {
    const { rerender } = render(<Harness agent="codex" />)
    expect(screen.queryByLabelText('policy')).toBeNull()

    storeState.settings.agentDefaultArgs = { claude: '' }
    rerender(<Harness key="manual" />)
    expect(screen.queryByLabelText('policy')).toBeNull()
  })

  it('stays hidden on SSH and on a paired runtime, whose hook is not local', () => {
    const { rerender } = render(<Harness executionHostId="ssh:box" />)
    expect(screen.queryByLabelText('policy')).toBeNull()

    storeState.settings.activeRuntimeEnvironmentId = 'env-1'
    rerender(<Harness key="paired" />)
    expect(screen.queryByLabelText('policy')).toBeNull()
  })

  it('starts the list with nothing checked and drives it with the quick selects', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    fireEvent.change(policySelect(), { target: { value: 'catalog' } })
    expect(onChange).toHaveBeenLastCalledWith({ mode: 'catalog', categories: [] })
    expect(screen.getByText('0 of 4 selected')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Most used' }))
    expect(onChange).toHaveBeenLastCalledWith({
      mode: 'catalog',
      categories: ['working-directory']
    })
    expect(screen.getByText('1 of 4 selected')).toBeTruthy()
    // Why: only the categories whose target is resolved at run time carry the caution.
    expect(screen.getAllByText(/can't see the target/)).toHaveLength(2)

    fireEvent.click(screen.getByRole('checkbox', { name: /Mounted drive/ }))
    expect(onChange).toHaveBeenLastCalledWith({
      mode: 'catalog',
      categories: ['working-directory', 'mounted-drive']
    })

    fireEvent.click(screen.getByRole('checkbox', { name: /Workspace folder/ }))
    expect(onChange).toHaveBeenLastCalledWith({
      mode: 'catalog',
      categories: ['mounted-drive']
    })

    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(screen.getByText('4 of 4 selected')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'None (clear)' }))
    expect(onChange).toHaveBeenLastCalledWith({ mode: 'catalog', categories: [] })
  })

  it('says plainly that approve everything includes deleting the workspace folder', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    fireEvent.change(policySelect(), { target: { value: 'approve-all' } })
    expect(onChange).toHaveBeenLastCalledWith({ mode: 'approve-all' })
    expect(screen.getByText(/including deleting this workspace folder/)).toBeTruthy()

    fireEvent.change(policySelect(), { target: { value: 'ask' } })
    expect(onChange).toHaveBeenLastCalledWith(null)
  })
})
