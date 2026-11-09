import type { GlobalSettings } from '../../../../shared/global-settings-types'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host'
import { parseWslUncPath } from '../../../../shared/wsl-paths'
import {
  listWorktreeAgentAccountChoices,
  type WorktreeAccountAgent,
  type WorktreeAgentAccountChoice
} from '../../../../shared/worktree-agent-account'

// Why codex only: Claude launches still read the global selection; it joins in phase 4.
const PICKABLE_ACCOUNT_AGENTS: readonly WorktreeAccountAgent[] = ['codex']

function toPickableAccountAgent(agent: TuiAgent | null): WorktreeAccountAgent | null {
  return PICKABLE_ACCOUNT_AGENTS.find((candidate) => candidate === agent) ?? null
}

/**
 * Accounts a new worktree may pin, or null when the picker must stay hidden:
 * an agent without pinning, a non-local host (SSH or paired runtime own their
 * own accounts), or a lane with fewer than two managed accounts.
 */
export function resolveAgentAccountPickerChoices(args: {
  agent: TuiAgent | null
  executionHostId: string | null | undefined
  repoPath: string | null | undefined
  settings:
    | Pick<
        GlobalSettings,
        'codexManagedAccounts' | 'claudeManagedAccounts' | 'activeRuntimeEnvironmentId'
      >
    | null
    | undefined
}): { agent: WorktreeAccountAgent; choices: WorktreeAgentAccountChoice[] } | null {
  const agent = toPickableAccountAgent(args.agent)
  if (
    !agent ||
    !args.settings ||
    args.settings.activeRuntimeEnvironmentId?.trim() ||
    args.executionHostId !== LOCAL_EXECUTION_HOST_ID
  ) {
    return null
  }
  const wslRepo = args.repoPath ? parseWslUncPath(args.repoPath) : null
  const choices = listWorktreeAgentAccountChoices({
    agent,
    target: wslRepo ? { runtime: 'wsl', wslDistro: wslRepo.distro } : { runtime: 'host' },
    settings: args.settings
  })
  return choices.length > 1 ? { agent, choices } : null
}

/** The pin to submit: only one the picker would offer right now for the chosen agent. */
export function resolveSubmittedAgentAccountId(
  args: Parameters<typeof resolveAgentAccountPickerChoices>[0] & { value: string | null }
): string | undefined {
  const picker = args.value ? resolveAgentAccountPickerChoices(args) : null
  return picker?.choices.some((choice) => choice.id === args.value)
    ? (args.value ?? undefined)
    : undefined
}
