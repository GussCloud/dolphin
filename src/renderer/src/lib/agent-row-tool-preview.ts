import type { AgentStatusEntry } from '../../../shared/agent-status-types'
import type { AgentRowState } from './agent-row-decay-state'

/**
 * States whose cached tool fields describe live work: 'working' names the tool the agent is
 * running, 'waiting' names the tool a permission request is blocked on. Tool fields outlive
 * the turn that set them, so on any other state they read as work still in flight.
 *
 * Shared because three surfaces render this line — the sidebar's compact row, the dashboard
 * row, and the activity thread — and a rule that only two of them relax is a rule that lies.
 */
export function showsAgentToolPreview(state: AgentRowState | null | undefined): boolean {
  return state === 'working' || state === 'waiting'
}

export type AgentToolPreviewParts = { toolName: string; toolInput: string }

/** Trimmed tool name and input under the shared state gate, or null when there is nothing to show. */
export function getAgentToolPreviewParts(
  entry: Pick<AgentStatusEntry, 'toolName' | 'toolInput'>,
  state: AgentRowState | null | undefined
): AgentToolPreviewParts | null {
  if (!showsAgentToolPreview(state)) {
    return null
  }
  const toolName = entry.toolName?.trim() ?? ''
  // Why: an input without a tool name has nothing to label it, so it is never shown alone.
  if (!toolName) {
    return null
  }
  return { toolName, toolInput: entry.toolInput?.trim() ?? '' }
}

/** One-line `tool: input` preview, or '' when the state or the entry has nothing to show. */
export function formatAgentToolPreview(
  entry: Pick<AgentStatusEntry, 'toolName' | 'toolInput'>,
  state: AgentRowState | null | undefined
): string {
  const parts = getAgentToolPreviewParts(entry, state)
  if (!parts) {
    return ''
  }
  return parts.toolInput ? `${parts.toolName}: ${parts.toolInput}` : parts.toolName
}
