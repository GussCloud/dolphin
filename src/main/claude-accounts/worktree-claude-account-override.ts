import type { GlobalSettings } from '../../shared/global-settings-types'
import type { ClaudeManagedAccount } from '../../shared/managed-account-types'
import { resolveWorktreeAgentAccount } from '../../shared/worktree-agent-account'
import {
  findLaunchWorktree,
  type WorktreeAccountMetaSource,
  type WorktreeLaunchLocation
} from '../worktree-launch-owner'
import {
  getSelectedClaudeAccountIdForTarget,
  type ClaudeAccountSelectionTarget
} from './runtime-selection'

type LaunchAccountSettings = Pick<
  GlobalSettings,
  | 'activeClaudeManagedAccountId'
  | 'activeClaudeManagedAccountIdsByRuntime'
  | 'claudeManagedAccounts'
  | 'codexManagedAccounts'
>

export type ClaudeLaunchAccountOverride =
  | { kind: 'none' }
  | { kind: 'override'; account: ClaudeManagedAccount; worktreeId: string }
  | { kind: 'unavailable'; accountId: string; worktreeId: string; reason: string }

/**
 * Which Claude account a launch must use because its worktree pinned one.
 * `none` means the global selection, including a pin equal to it.
 */
export function resolveClaudeLaunchAccountOverride(args: {
  source: WorktreeAccountMetaSource | null | undefined
  settings: LaunchAccountSettings | undefined
  target?: ClaudeAccountSelectionTarget
  launch: WorktreeLaunchLocation | undefined
}): ClaudeLaunchAccountOverride {
  if (!args.source || !args.settings || !args.launch) {
    return { kind: 'none' }
  }
  const owner = findLaunchWorktree(args.source, args.launch)
  if (!owner?.meta.agentAccountId) {
    return { kind: 'none' }
  }
  const resolution = resolveWorktreeAgentAccount({
    agentAccountId: owner.meta.agentAccountId,
    agent: 'claude',
    target: args.target,
    settings: args.settings
  })
  if (resolution.kind === 'global') {
    return { kind: 'none' }
  }
  if (resolution.kind === 'unavailable') {
    return {
      kind: 'unavailable',
      accountId: resolution.accountId,
      worktreeId: owner.worktreeId,
      reason: resolution.reason
    }
  }
  if (getSelectedClaudeAccountIdForTarget(args.settings, args.target) === resolution.accountId) {
    return { kind: 'none' }
  }
  const account = args.settings.claudeManagedAccounts.find(
    (entry) => entry.id === resolution.accountId
  )
  return account ? { kind: 'override', account, worktreeId: owner.worktreeId } : { kind: 'none' }
}
