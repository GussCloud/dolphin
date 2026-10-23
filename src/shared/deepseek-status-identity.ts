import type { AgentStatusDisplayAgentType, AgentType } from './agent-status-types'
import { DEEPSEEK_CLAUDE_CONFIG_DIR_NAME, isDeepSeekTuiAgent } from './deepseek-claude-provider'

// Why: DeepSeek panes run the Claude Code CLI, so the hook host keeps their rows `claude` (every
// Claude status rule applies) and stamps `displayAgentType: 'deepseek'` for readers to show.

/** A Claude hook transcript under the DeepSeek config dir proves the pane runs DeepSeek. */
export function isDeepSeekClaudeTranscriptPath(transcriptPath: string | null | undefined): boolean {
  if (!transcriptPath) {
    return false
  }
  return transcriptPath.split(/[\\/]+/).includes(DEEPSEEK_CLAUDE_CONFIG_DIR_NAME)
}

/**
 * The one DeepSeek identity rule, run by the host at write time and by the renderer for old hosts.
 * A transcript path is per-event evidence; an event without one (OSC, inferred) keeps the row's.
 */
export function resolveDeepSeekDisplayAgentType(args: {
  agentType: AgentType | null | undefined
  transcriptPath: string | null | undefined
  previousDisplayAgentType: AgentStatusDisplayAgentType | null | undefined
}): AgentStatusDisplayAgentType | undefined {
  // Only the Claude Code CLI writes transcripts under a CLAUDE_CONFIG_DIR.
  if (args.agentType !== 'claude') {
    return undefined
  }
  if (args.transcriptPath) {
    return isDeepSeekClaudeTranscriptPath(args.transcriptPath) ? 'deepseek' : undefined
  }
  return args.previousDisplayAgentType ?? undefined
}

/** True for rows the host stamped `claude`, including those the renderer re-labelled `deepseek`. */
export function isClaudeHookAgentType(agentType: AgentType | null | undefined): boolean {
  return agentType === 'claude' || agentType === 'deepseek'
}

/** The agent type the hook host holds for this row; inference requests must match it. */
export function toHookHostAgentType(agentType: AgentType | undefined): AgentType | undefined {
  return agentType === 'deepseek' ? 'claude' : agentType
}

/** A Claude title in a DeepSeek pane is the same CLI's frame, not another agent reusing the pane. */
export function isClaudeTitleOfDeepSeekPane(
  left: AgentType | null | undefined,
  right: AgentType | null | undefined
): boolean {
  return (
    (left === 'claude' && isDeepSeekTuiAgent(right)) ||
    (right === 'claude' && isDeepSeekTuiAgent(left))
  )
}
