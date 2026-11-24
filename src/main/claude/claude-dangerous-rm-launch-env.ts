import { isDeepSeekLaunchRequest } from '../deepseek/deepseek-launch-request'
import { isClaudeLaunchCommand } from '../ipc/pty/host-env/fresh-spawn-routing'
import {
  CLAUDE_DANGEROUS_RM_NO_TIMEOUT_ENV,
  resolveClaudeDangerousRmNoTimeoutValue
} from './claude-dangerous-rm-prompt-env'

type Env = Record<string, string | undefined>

/** Agents that run the Claude CLI: claude, deepseek and their Agent Teams variants. */
export function isClaudeCompatibleAgentLaunch(args: {
  launchAgent: unknown
  command: string | undefined
  env: Env | undefined
}): boolean {
  return (
    args.launchAgent === 'claude' ||
    args.launchAgent === 'claude-agent-teams' ||
    isDeepSeekLaunchRequest({ launchAgent: args.launchAgent, env: args.env }) ||
    isClaudeLaunchCommand(args.command)
  )
}

/** Sets the no-timeout var for a Claude-compatible launch, keeping a value the user already set. */
export function withClaudeDangerousRmNoTimeoutEnv(
  env: Record<string, string> | undefined,
  launch: { launchAgent: unknown; command: string | undefined },
  inheritedEnv: Env = process.env
): Record<string, string> | undefined {
  if (!isClaudeCompatibleAgentLaunch({ ...launch, env })) {
    return env
  }
  const value = resolveClaudeDangerousRmNoTimeoutValue(env, inheritedEnv)
  if (env?.[CLAUDE_DANGEROUS_RM_NO_TIMEOUT_ENV] === value) {
    return env
  }
  return { ...env, [CLAUDE_DANGEROUS_RM_NO_TIMEOUT_ENV]: value }
}
