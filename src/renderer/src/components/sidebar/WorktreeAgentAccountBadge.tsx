import React from 'react'
import { KeyRound, TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { parseWslUncPath } from '../../../../shared/wsl-paths'
import {
  resolveWorktreeAgentAccount,
  type WorktreeAccountAgent
} from '../../../../shared/worktree-agent-account'
import type { Worktree } from '../../../../shared/worktree/types'

/** Shows the account a worktree pinned for its agent, or that the pin fell back. */
export function WorktreeAgentAccountBadge({
  worktree
}: {
  worktree: Pick<Worktree, 'agentAccountId' | 'path'>
}): React.JSX.Element | null {
  const settings = useAppStore((s) => s.settings)
  if (!worktree.agentAccountId || !settings) {
    return null
  }
  const wslWorktree = parseWslUncPath(worktree.path)
  const target = wslWorktree
    ? { runtime: 'wsl' as const, wslDistro: wslWorktree.distro }
    : { runtime: 'host' as const }
  // Why both: one field pins the account of whichever agent the worktree was created with.
  const resolve = (agent: WorktreeAccountAgent) =>
    resolveWorktreeAgentAccount({
      agentAccountId: worktree.agentAccountId,
      agent,
      target,
      settings
    })
  const codex = resolve('codex')
  const agent: WorktreeAccountAgent = codex.kind === 'global' ? 'claude' : 'codex'
  const resolution = codex.kind === 'global' ? resolve('claude') : codex
  if (resolution.kind === 'global') {
    return null
  }
  const unavailable = resolution.kind === 'unavailable'
  const accounts =
    agent === 'codex' ? settings.codexManagedAccounts : settings.claudeManagedAccounts
  const email = unavailable
    ? null
    : accounts.find((account) => account.id === resolution.accountId)?.email
  const label = unavailable
    ? translate('auto.components.sidebar.WorktreeAgentAccountBadge.unavailable', 'Account missing')
    : (email ?? '')
  const tooltip = unavailable
    ? resolution.reason === 'missing'
      ? // Why: a deleted account no longer says which agent it served.
        translate(
          'auto.components.sidebar.WorktreeAgentAccountBadge.missingDetail',
          'The account this workspace was created with is no longer available. Launches here use the active account.'
        )
      : agent === 'codex'
        ? translate(
            'auto.components.sidebar.WorktreeAgentAccountBadge.unavailableDetail',
            'The Codex account this workspace was created with is no longer available. Codex launches here use the active account.'
          )
        : translate(
            'auto.components.sidebar.WorktreeAgentAccountBadge.claudeUnavailableDetail',
            'The Claude account this workspace was created with is no longer available. Claude launches here use the active account.'
          )
    : agent === 'codex'
      ? translate(
          'auto.components.sidebar.WorktreeAgentAccountBadge.pinned',
          'Codex account: {{value0}}',
          {
            value0: label
          }
        )
      : translate(
          'auto.components.sidebar.WorktreeAgentAccountBadge.claudePinned',
          'Claude account: {{value0}}',
          { value0: label }
        )
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="hostContext"
          className="max-w-[8rem]"
          data-worktree-agent-account={unavailable ? 'unavailable' : 'pinned'}
          aria-label={tooltip}
        >
          {unavailable ? (
            <TriangleAlert className="size-2.5 text-status-warning" />
          ) : (
            <KeyRound className="size-2.5" />
          )}
          <span className="truncate">{label}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} className="max-w-64">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}
