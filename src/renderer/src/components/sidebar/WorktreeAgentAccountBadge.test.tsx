// @vitest-environment happy-dom

import React from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const storeState = vi.hoisted(() => ({
  settings: {
    codexManagedAccounts: [
      {
        id: 'acct-pinned',
        email: 'pinned@example.test',
        managedHomePath: '/data/codex-accounts/acct-pinned/home',
        createdAt: 0,
        updatedAt: 0,
        lastAuthenticatedAt: 0
      }
    ],
    claudeManagedAccounts: []
  }
}))

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, string>) =>
    fallback.replace('{{value0}}', values?.value0 ?? '')
}))
vi.mock('@/store', () => ({
  useAppStore: (selector: (state: typeof storeState) => unknown) => selector(storeState)
}))
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: () => null
}))

import { WorktreeAgentAccountBadge } from './WorktreeAgentAccountBadge'

afterEach(cleanup)

describe('WorktreeAgentAccountBadge', () => {
  it('names the pinned account', () => {
    const { container } = render(
      <WorktreeAgentAccountBadge worktree={{ agentAccountId: 'acct-pinned', path: '/repos/a' }} />
    )
    const badge = container.querySelector('[data-worktree-agent-account]')
    expect(badge?.getAttribute('data-worktree-agent-account')).toBe('pinned')
    expect(badge?.textContent).toBe('pinned@example.test')
  })

  it('warns when the pinned account no longer exists', () => {
    const { container } = render(
      <WorktreeAgentAccountBadge worktree={{ agentAccountId: 'acct-removed', path: '/repos/a' }} />
    )
    const badge = container.querySelector('[data-worktree-agent-account]')
    expect(badge?.getAttribute('data-worktree-agent-account')).toBe('unavailable')
    expect(badge?.getAttribute('aria-label')).toContain('use the active account')
  })

  it('renders nothing for a worktree without a pin', () => {
    const { container } = render(<WorktreeAgentAccountBadge worktree={{ path: '/repos/a' }} />)
    expect(container.innerHTML).toBe('')
  })
})
