// Launch env for an autonomous-goal coordinator: Dolphin's handoff rotation replaces the Claude
// Code CLI's own auto-compaction, which summarizes lossily and mid-task.
import { AUTONOMOUS_GOAL_AGENT_CLI, isAutonomousGoalAgent } from './autonomous-goal-types'

/** Claude Code 2.1.x: turns off auto-compaction only; manual `/compact` keeps working. */
export const CLAUDE_DISABLE_AUTO_COMPACT_ENV = 'DISABLE_AUTO_COMPACT'

export function isClaudeAutoCompactDisabledEnv(
  env: Record<string, string | undefined> | undefined
): boolean {
  const value = env?.[CLAUDE_DISABLE_AUTO_COMPACT_ENV]?.trim().toLowerCase()
  return value !== undefined && value !== '' && value !== '0' && value !== 'false'
}

/**
 * Whether rotation can measure a coordinator's context: its transcript is on this host's own
 * filesystem. False over SSH and inside WSL (a launch platform other than the host's), where
 * rotation counts turns instead. Launch (auto-compaction off) and rotation (read or count) both
 * decide from this one rule.
 */
export function isCoordinatorContextMeasurable(args: {
  remote: boolean
  launchPlatform: NodeJS.Platform
  hostPlatform: NodeJS.Platform
}): boolean {
  return !args.remote && args.launchPlatform === args.hostPlatform
}

/** A WSL coordinator on Windows writes a POSIX transcript path; the host can't open it. */
export function coordinatorTranscriptPlatform(
  transcriptPath: string,
  hostPlatform: NodeJS.Platform
): NodeJS.Platform {
  return hostPlatform === 'win32' && !/^(?:[A-Za-z]:[\\/]|\\\\)/u.test(transcriptPath)
    ? 'linux'
    : hostPlatform
}

/**
 * Asks main to load the orchestration channel into this launch, so mailbox pointers arrive as
 * channel messages instead of typed text. Main still gates on agent, host and Claude version.
 */
export const AUTONOMOUS_COORDINATOR_CHANNEL_ENV = 'DOLPHIN_AUTONOMOUS_COORDINATOR_CHANNEL'

/**
 * Only where the context is measurable (`isCoordinatorContextMeasurable`): elsewhere rotation is a
 * blind turn count, so the CLI's auto-compaction stays on as the backstop. The channel server is
 * Dolphin's local binary, so the same local-native rule gates it.
 */
export function buildAutonomousCoordinatorLaunchEnv(args: {
  agent: unknown
  transcriptReadableOnHost: boolean
}): Record<string, string> {
  if (
    !args.transcriptReadableOnHost ||
    !isAutonomousGoalAgent(args.agent) ||
    AUTONOMOUS_GOAL_AGENT_CLI[args.agent] !== 'claude'
  ) {
    return {}
  }
  return {
    [CLAUDE_DISABLE_AUTO_COMPACT_ENV]: '1',
    // Why plain `claude` only: DeepSeek must never auto-accept a dialog on its account, and Agent
    // Teams launches through a wrapper the flags cannot be spliced into.
    ...(args.agent === 'claude' ? { [AUTONOMOUS_COORDINATOR_CHANNEL_ENV]: '1' } : {})
  }
}
