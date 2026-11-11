import type { GlobalSettings } from '../../shared/global-settings-types'
import type { CodexManagedAccount } from '../../shared/managed-account-types'
import {
  findLaunchAccountCandidates,
  type WorktreeAccountMetaSource
} from '../worktree-launch-owner'
import { resolveWorktreeAgentAccount } from '../../shared/worktree-agent-account'
import {
  getSelectedCodexAccountIdForTarget,
  type CodexAccountSelectionTarget
} from './runtime-selection'

type LaunchAccountSettings = Pick<
  GlobalSettings,
  | 'activeCodexManagedAccountId'
  | 'activeCodexManagedAccountIdsByRuntime'
  | 'codexManagedAccounts'
  | 'claudeManagedAccounts'
>

export type CodexLaunchAccountOverride =
  | { kind: 'none' }
  | { kind: 'override'; account: CodexManagedAccount; worktreeId: string }
  | { kind: 'unavailable'; accountId: string; worktreeId: string; reason: string }

/**
 * Which Codex account a launch must use because its worktree pinned one.
 * `none` means the global selection (today's behavior, including a pin equal to it).
 */
export function resolveCodexLaunchAccountOverride(args: {
  source: WorktreeAccountMetaSource | null | undefined
  settings: LaunchAccountSettings | undefined
  target?: CodexAccountSelectionTarget
  worktreeId?: string
  workspacePath?: string
}): CodexLaunchAccountOverride {
  if (!args.source || !args.settings) {
    return { kind: 'none' }
  }
  for (const candidate of findLaunchAccountCandidates(args.source, args, 'codex')) {
    const resolution = resolveWorktreeAgentAccount({
      agentAccountId: candidate.accountId,
      agent: 'codex',
      target: args.target,
      settings: args.settings
    })
    // Why: a pin for the other agent is not this launch's; the project default may still apply.
    if (resolution.kind === 'global') {
      continue
    }
    if (resolution.kind === 'unavailable') {
      return {
        kind: 'unavailable',
        accountId: resolution.accountId,
        worktreeId: candidate.worktreeId,
        reason: resolution.reason
      }
    }
    if (getSelectedCodexAccountIdForTarget(args.settings, args.target) === resolution.accountId) {
      return { kind: 'none' }
    }
    const account = args.settings.codexManagedAccounts.find(
      (entry) => entry.id === resolution.accountId
    )
    return account
      ? { kind: 'override', account, worktreeId: candidate.worktreeId }
      : { kind: 'none' }
  }
  return { kind: 'none' }
}
