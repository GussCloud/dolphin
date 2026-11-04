import {
  AGENT_MODEL_MAX_LENGTH,
  normalizeAgentStatusPayload,
  type AgentStatusState,
  type AgentWorkingMode,
  type ParsedAgentStatusPayload
} from '../../agent-status-types'
import { claudeRosterToSnapshots } from '../../claude-subagent-roster'
import { resolvePrompt, resolveToolState } from '../prompt-fields'
import { extractToolFields, isNewTurnEvent } from '../provider-event-routing'
import type { HookListenerState } from '../listener-state'
import { mainAgentTurnInterrupted } from '../../agent-lead-status-fold'
import { claudeMainAgentStatusForPayload } from './claude-roster-state'
import { normalizeOptionalField } from '../../agent-status-field-normalization'

/** Only SessionStart names the model; a session without one (older CLI) publishes none. */
export function recordClaudeSessionModel(
  state: HookListenerState,
  paneKey: string,
  hookPayload: Record<string, unknown>
): void {
  const model = normalizeOptionalField(hookPayload['model'], AGENT_MODEL_MAX_LENGTH)
  if (model) {
    state.claudeModelByPaneKey.set(paneKey, model)
  } else {
    state.claudeModelByPaneKey.delete(paneKey)
  }
}

export function buildClaudeStatusPayload(
  state: HookListenerState,
  eventName: unknown,
  promptText: string,
  paneKey: string,
  hookPayload: Record<string, unknown>,
  options: {
    stateName: AgentStatusState
    workingMode?: AgentWorkingMode
    updateToolSnapshot: boolean
    sessionBoundary?: boolean
  }
): ParsedAgentStatusPayload | null {
  // Why: child-driven refreshes are roster bookkeeping, not lead tool activity; read the cached snapshot without merging so they can't clear a live AskUserQuestion card or clobber the tool preview.
  const snapshot = options.updateToolSnapshot
    ? resolveToolState(state, paneKey, extractToolFields('claude', eventName, hookPayload), {
        resetOnNewTurn: isNewTurnEvent('claude', eventName)
      })
    : (state.lastToolByPaneKey.get(paneKey) ?? {})

  // Why: every path writes the main agent record before building, so the row's `mainAgent`, its
  // `interrupted` flag and its turn stamp are all read off that one record rather than restated by
  // each caller. The normalizer clamps `interrupted` to done payloads, so a row held open by child
  // work drops it; the record keeps the verdict for the eventual done.
  const mainAgentRecord = state.claudeLeadStateByPaneKey.get(paneKey)
  // Why: validate directly — the JSON stringify/parse round trip other normalizers use is pure overhead on this hot per-hook path.
  return normalizeAgentStatusPayload({
    state: options.stateName,
    workingMode: options.workingMode,
    // Why: only lead-origin events may reset the prompt cache; a child-driven refresh must not blank the lead's prompt label.
    prompt: resolvePrompt(state, paneKey, promptText, {
      resetOnNewTurn: options.updateToolSnapshot && isNewTurnEvent('claude', eventName)
    }),
    agentType: 'claude',
    model: state.claudeModelByPaneKey.get(paneKey),
    toolName: snapshot.toolName,
    toolInput: snapshot.toolInput,
    interactivePrompt: snapshot.interactivePrompt,
    lastAssistantMessage: snapshot.lastAssistantMessage,
    lastAssistantMessageIsToolOutput: snapshot.lastAssistantMessageIsToolOutput,
    interrupted: mainAgentTurnInterrupted(mainAgentRecord),
    sessionBoundary: options.sessionBoundary,
    turnCompletedAt: mainAgentRecord?.turnCompletedAt,
    subagents: claudeRosterToSnapshots(state.claudeSubagentRosterByPaneKey.get(paneKey)),
    mainAgent: mainAgentRecord ? claudeMainAgentStatusForPayload(mainAgentRecord) : undefined
  })
}
