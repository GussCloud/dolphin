import type { AgentStatusDisplayAgentType, AgentType } from './agent-status-types'
import { isClaudeApiTuiAgent } from './claude-api-provider'
import { DEEPSEEK_CLAUDE_CONFIG_DIR_NAME, isDeepSeekTuiAgent } from './deepseek-claude-provider'

// Why: DeepSeek and API-key panes run the Claude Code CLI, so the hook host keeps their rows
// `claude` (every Claude status rule applies) and stamps `displayAgentType` for readers to show.

/** A Claude hook transcript under the DeepSeek config dir proves the pane runs DeepSeek. */
export function isDeepSeekClaudeTranscriptPath(transcriptPath: string | null | undefined): boolean {
  if (!transcriptPath) {
    return false
  }
  return transcriptPath.split(/[\\/]+/).includes(DEEPSEEK_CLAUDE_CONFIG_DIR_NAME)
}

/**
 * The one presentation identity rule for Claude Code rows, run by the host at write time and by
 * the renderer for old hosts. A transcript path is per-event evidence; an event without one (OSC,
 * inferred) keeps the row's. API profiles have no fixed dir name, so only a caller holding the
 * host's account list can pass `isClaudeApiTranscriptPath`; without it no row turns `claude-api`.
 */
export function resolveClaudeDisplayAgentType(args: {
  agentType: AgentType | null | undefined
  transcriptPath: string | null | undefined
  previousDisplayAgentType: AgentStatusDisplayAgentType | null | undefined
  isClaudeApiTranscriptPath?: (transcriptPath: string) => boolean
}): AgentStatusDisplayAgentType | undefined {
  // Only the Claude Code CLI writes transcripts under a CLAUDE_CONFIG_DIR.
  if (args.agentType !== 'claude') {
    return undefined
  }
  if (args.transcriptPath) {
    if (isDeepSeekClaudeTranscriptPath(args.transcriptPath)) {
      return 'deepseek'
    }
    return args.isClaudeApiTranscriptPath?.(args.transcriptPath) ? 'claude-api' : undefined
  }
  return args.previousDisplayAgentType ?? undefined
}

/** True for rows the host stamped `claude`, including those the renderer re-labelled. */
export function isClaudeHookAgentType(agentType: AgentType | null | undefined): boolean {
  return agentType === 'claude' || agentType === 'deepseek' || agentType === 'claude-api'
}

/** The agent type the hook host holds for this row; inference requests must match it. */
export function toHookHostAgentType(agentType: AgentType | undefined): AgentType | undefined {
  return agentType === 'deepseek' || agentType === 'claude-api' ? 'claude' : agentType
}

/** A Claude title in a DeepSeek or API-key pane is the same CLI's frame, not another agent. */
export function isClaudeTitleOfOwnCredentialsPane(
  left: AgentType | null | undefined,
  right: AgentType | null | undefined
): boolean {
  // Why not isOwnCredentialsClaudeTuiAgent: that module imports this one (relaunch rule).
  const ownCredentials = (agent: AgentType | null | undefined): boolean =>
    isDeepSeekTuiAgent(agent) || isClaudeApiTuiAgent(agent)
  return (
    (left === 'claude' && ownCredentials(right)) || (right === 'claude' && ownCredentials(left))
  )
}
