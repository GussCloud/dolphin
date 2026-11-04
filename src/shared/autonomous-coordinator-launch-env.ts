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
 * Only where the context is measurable (`isCoordinatorContextMeasurable`): elsewhere rotation is a
 * blind turn count, so the CLI's auto-compaction stays on as the backstop.
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
  return { [CLAUDE_DISABLE_AUTO_COMPACT_ENV]: '1' }
}
