// @ts-nocheck -- the launch-plan adapter is kept independent from the runtime mixin chain.
import type { ClaudeAgentTeamsMode } from '../../shared/claude-agent-teams-tmux-compat'
import type { TerminalCreateOptions } from './runtime-terminal-contracts'
import type { AgentTeamHostShell } from './claude-agent-teams-host-shell'
import {
  addClaudeTeammateModeAuto,
  addClaudeTeammateModeInProcess,
  buildClaudeAgentTeamsLaunchPlan,
  inferCapturedClaudeAgentTeamsMode
} from './dolphin-runtime-create-terminal-dependencies'
import { timeTerminalSpawnStep } from '../worktree-create-terminal-spawn-timing'

export async function buildRuntimeAgentTeamsLaunchPlan(args: {
  launchConfig: TerminalCreateOptions['launchConfig']
  command?: string
  claudeAgentTeamsSourceCommand?: string
  claudeAgentTeamsMode?: ClaudeAgentTeamsMode
  baseEnv: Record<string, string | undefined>
  adoptedBeforeLaunch: boolean
  /** Leader execution host; decides whether native-Windows Git Bash is required. */
  hostShell?: AgentTeamHostShell | null
  createTeamEnv: (
    shimDir: string,
    shimBin: string,
    shimPathDirs: string[]
  ) => Record<string, string>
}): Promise<{
  plan: Awaited<ReturnType<typeof buildClaudeAgentTeamsLaunchPlan>> | undefined
  sequencedStartupCommand?: string
  effectiveLaunchConfig: TerminalCreateOptions['launchConfig']
}> {
  const sourceCommand =
    args.claudeAgentTeamsSourceCommand?.trim() || args.command?.trim() || undefined
  const mode = inferCapturedClaudeAgentTeamsMode(
    args.launchConfig,
    sourceCommand,
    args.claudeAgentTeamsMode
  )
  const plan = args.adoptedBeforeLaunch
    ? undefined
    : await timeTerminalSpawnStep('agent_teams_plan', () =>
        buildClaudeAgentTeamsLaunchPlan({
          command: sourceCommand,
          mode,
          baseEnv: args.baseEnv,
          hostShell: args.hostShell,
          createTeamEnv: args.createTeamEnv
        })
      )
  const sequencedStartupCommand =
    plan && sourceCommand && args.command && sourceCommand !== args.command
      ? plan.command
      : undefined
  const effectiveLaunchConfig =
    args.launchConfig && plan
      ? {
          ...args.launchConfig,
          agentCommand: args.launchConfig.agentCommand
            ? // Why: the plan may degrade to in-process (no Git Bash / CLI), so follow its verdict, not the requested mode.
              plan.teammateMode === 'in-process'
              ? addClaudeTeammateModeInProcess(args.launchConfig.agentCommand)
              : addClaudeTeammateModeAuto(args.launchConfig.agentCommand)
            : plan.command,
          agentEnv: { ...args.launchConfig.agentEnv, ...plan.env }
        }
      : args.launchConfig
  return { plan, sequencedStartupCommand, effectiveLaunchConfig }
}
