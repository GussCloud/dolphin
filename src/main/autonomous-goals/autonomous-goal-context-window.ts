// The context window an autonomous-goal coordinator rotates against. With the CLI's auto-compaction
// off, an overestimate overflows the session, so every unknown resolves to the smaller window.
import {
  isDeepSeekTuiAgent,
  DEEPSEEK_AUTO_COMPACT_WINDOW_TOKENS
} from '../../shared/deepseek-claude-provider'
import type { AutonomousGoalAgent } from '../../shared/autonomous-goal-types'
import { claudeContextWindowHint, contextBaseModelId } from '../claude/claude-context-usage'
import type { CoordinatorContextReading } from './autonomous-goal-context-probe'

/** Claude Code's window for a model whose name states none. */
export const AUTONOMOUS_GOAL_DEFAULT_CONTEXT_WINDOW_TOKENS = 200_000

/**
 * The model the session runs now. SessionStart names it with its `[1m]` suffix; a newest response
 * naming another base model means a mid-session `/model`, whose window that name alone decides.
 */
function currentCoordinatorModel(
  agent: AutonomousGoalAgent,
  sessionModel: string | undefined,
  responseModel: string | undefined
): string | undefined {
  // Why: DeepSeek's API answers with its own model ids, which never match the configured slot name.
  if (
    !isDeepSeekTuiAgent(agent) &&
    sessionModel &&
    responseModel &&
    contextBaseModelId(sessionModel) !== contextBaseModelId(responseModel)
  ) {
    return responseModel
  }
  return sessionModel ?? (isDeepSeekTuiAgent(agent) ? undefined : responseModel)
}

export function resolveCoordinatorContextWindow(args: {
  agent: AutonomousGoalAgent
  reading: CoordinatorContextReading
  /** The pane's SessionStart model from the agent-status store. */
  sessionModel?: string
}): number {
  if (args.reading.windowTokens && args.reading.windowTokens > 0) {
    return args.reading.windowTokens
  }
  const model = currentCoordinatorModel(args.agent, args.sessionModel, args.reading.responseModel)
  const hinted = model ? claudeContextWindowHint(model) : null
  if (isDeepSeekTuiAgent(args.agent)) {
    // Why: the default slots are `[1m]`, but DeepSeek's guide caps the usable window below 1M.
    return model && hinted === null
      ? AUTONOMOUS_GOAL_DEFAULT_CONTEXT_WINDOW_TOKENS
      : DEEPSEEK_AUTO_COMPACT_WINDOW_TOKENS
  }
  return hinted ?? AUTONOMOUS_GOAL_DEFAULT_CONTEXT_WINDOW_TOKENS
}
