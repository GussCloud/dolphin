import type { AgentType } from './agent-status-types'
import { DEEPSEEK_CLAUDE_CONFIG_DIR_NAME, isDeepSeekTuiAgent } from './deepseek-claude-provider'

// Why: DeepSeek panes run the Claude Code CLI, so the hook host stamps their rows `claude` and
// keeps every Claude status rule. Only the renderer re-labels them `deepseek` for presentation.

/** A Claude hook transcript under the DeepSeek config dir proves the pane runs DeepSeek. */
export function isDeepSeekClaudeTranscriptPath(transcriptPath: string | null | undefined): boolean {
  if (!transcriptPath) {
    return false
  }
  return transcriptPath.split(/[\\/]+/).includes(DEEPSEEK_CLAUDE_CONFIG_DIR_NAME)
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
