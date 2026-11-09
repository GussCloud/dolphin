import type { GlobalSettings } from './global-settings-types'
import {
  normalizeCodexAccountSelectionTarget,
  type CodexAccountSelectionTarget
} from './codex-selection-lane'
import { parseWslUncPath } from './wsl-paths'

/** Agents whose launch account a worktree can pin. Claude lands in a later phase. */
export type WorktreeAccountAgent = 'codex' | 'claude'

export type WorktreeAgentAccountSettings = Partial<
  Pick<GlobalSettings, 'codexManagedAccounts' | 'claudeManagedAccounts'>
>

export type WorktreeAgentAccountChoice = {
  id: string
  email: string
  workspaceLabel: string | null
}

export type WorktreeAgentAccountResolution =
  | { kind: 'global' }
  | { kind: 'override'; accountId: string }
  | { kind: 'unavailable'; accountId: string; reason: 'missing' | 'other-runtime' }

type AccountLane = { runtime: 'host' | 'wsl'; wslDistro: string | null }

type LaneAccount = WorktreeAgentAccountChoice & { lane: AccountLane }

function codexAccountLane(
  account: NonNullable<WorktreeAgentAccountSettings['codexManagedAccounts']>[number]
): AccountLane {
  if (account.managedHomeRuntime === 'wsl') {
    return { runtime: 'wsl', wslDistro: account.wslDistro?.trim() || null }
  }
  const legacyWslHome = parseWslUncPath(account.managedHomePath)
  return legacyWslHome
    ? { runtime: 'wsl', wslDistro: legacyWslHome.distro }
    : { runtime: 'host', wslDistro: null }
}

function claudeAccountLane(
  account: NonNullable<WorktreeAgentAccountSettings['claudeManagedAccounts']>[number]
): AccountLane {
  return account.managedAuthRuntime === 'wsl'
    ? { runtime: 'wsl', wslDistro: account.wslDistro?.trim() || null }
    : { runtime: 'host', wslDistro: null }
}

function listAgentAccounts(
  agent: WorktreeAccountAgent,
  settings: WorktreeAgentAccountSettings
): LaneAccount[] {
  if (agent === 'codex') {
    return (settings.codexManagedAccounts ?? []).map((account) => ({
      id: account.id,
      email: account.email,
      workspaceLabel: account.workspaceLabel ?? null,
      lane: codexAccountLane(account)
    }))
  }
  return (settings.claudeManagedAccounts ?? []).map((account) => ({
    id: account.id,
    email: account.email,
    workspaceLabel: account.organizationName ?? null,
    lane: claudeAccountLane(account)
  }))
}

function laneAccepts(lane: AccountLane, target?: CodexAccountSelectionTarget | null): boolean {
  const normalized = normalizeCodexAccountSelectionTarget(target)
  if (lane.runtime !== normalized.runtime) {
    return false
  }
  // Why: a null target distro means "the default distro", which only main can resolve.
  return (
    normalized.runtime === 'host' ||
    normalized.wslDistro === null ||
    lane.wslDistro === null ||
    lane.wslDistro.toLowerCase() === normalized.wslDistro.toLowerCase()
  )
}

/** Accounts a worktree on `target` may pin for `agent`. */
export function listWorktreeAgentAccountChoices(args: {
  agent: WorktreeAccountAgent
  target?: CodexAccountSelectionTarget | null
  settings: WorktreeAgentAccountSettings
}): WorktreeAgentAccountChoice[] {
  return listAgentAccounts(args.agent, args.settings)
    .filter((account) => laneAccepts(account.lane, args.target))
    .map(({ id, email, workspaceLabel }) => ({ id, email, workspaceLabel }))
}

/**
 * Which account a launch of `agent` in a worktree pinned to `agentAccountId`
 * should use. `global` keeps the runtime-wide selection (today's behavior);
 * `unavailable` also falls back to it, but callers must surface the fallback.
 */
export function resolveWorktreeAgentAccount(args: {
  agentAccountId: string | null | undefined
  agent: WorktreeAccountAgent
  target?: CodexAccountSelectionTarget | null
  settings: WorktreeAgentAccountSettings
}): WorktreeAgentAccountResolution {
  const accountId = args.agentAccountId?.trim()
  if (!accountId) {
    return { kind: 'global' }
  }
  const account = listAgentAccounts(args.agent, args.settings).find(
    (entry) => entry.id === accountId
  )
  if (!account) {
    const otherAgent: WorktreeAccountAgent = args.agent === 'codex' ? 'claude' : 'codex'
    // Why: one field pins the account of the agent chosen at creation; another agent's
    // terminal in the same worktree keeps the global selection without a warning.
    const pinnedForOtherAgent = listAgentAccounts(otherAgent, args.settings).some(
      (entry) => entry.id === accountId
    )
    return pinnedForOtherAgent
      ? { kind: 'global' }
      : { kind: 'unavailable', accountId, reason: 'missing' }
  }
  if (!laneAccepts(account.lane, args.target)) {
    return { kind: 'unavailable', accountId, reason: 'other-runtime' }
  }
  return { kind: 'override', accountId }
}
