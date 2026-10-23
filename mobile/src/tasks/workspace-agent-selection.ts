import type { TuiAgent } from '../../../src/shared/tui-agent'
import { isDeepSeekTuiAgent } from '../../../src/shared/deepseek-claude-provider'
import {
  filterEnabledMobileTuiAgents,
  isMobileTuiAgent,
  isMobileTuiAgentEnabled,
  MOBILE_TUI_AGENT_AUTO_PICK_ORDER,
  MOBILE_TUI_AGENT_LABELS,
  pickMobileTuiAgent
} from './mobile-tui-agents'
import { translateTasks as t } from './tasks-translate'

export type WorkspaceAgentChoice = TuiAgent | 'blank'

type WorkspaceAgentSettings = {
  defaultTuiAgent?: TuiAgent | 'blank' | null
  disabledTuiAgents?: unknown
}

export type WorkspaceAgentSelectionState = {
  agent: WorkspaceAgentChoice | null
  overridden: boolean
}

type ResolveWorkspaceAgentSelectionArgs = WorkspaceAgentSelectionState & {
  selectionActive: boolean
  settings: WorkspaceAgentSettings
  detectedAgentIds: Set<string> | null
}

export function workspaceAgentLabel(agent: WorkspaceAgentChoice): string {
  return agent === 'blank' ? t('blankTerminal') : MOBILE_TUI_AGENT_LABELS[agent]
}

export function normalizeWorkspaceAgent(value: unknown): WorkspaceAgentChoice | null {
  if (value === 'blank' || value === '__blank__') {
    return 'blank'
  }
  return isMobileTuiAgent(value) ? value : null
}

/**
 * Whether the composer may offer `agent` for a host whose detected agents are known (a Set) or
 * unknown (null). Why: with detection unknown the host may predate DeepSeek, and an older host
 * drops worktree.create's unknown agent and starts its own default agent instead.
 */
export function isWorkspaceAgentOfferable(
  agent: TuiAgent,
  detectedAgentIds: Set<string> | null
): boolean {
  return detectedAgentIds === null ? !isDeepSeekTuiAgent(agent) : detectedAgentIds.has(agent)
}

export function pickWorkspaceAgent(
  settings: WorkspaceAgentSettings,
  detectedAgentIds: Set<string> | null
): WorkspaceAgentChoice {
  const preferred = normalizeWorkspaceAgent(settings.defaultTuiAgent)
  if (preferred === 'blank') {
    return preferred
  }
  const disabled = settings.disabledTuiAgents
  const enabledAutoPickOrder = filterEnabledMobileTuiAgents(
    MOBILE_TUI_AGENT_AUTO_PICK_ORDER,
    disabled
  ).filter((agent) => isWorkspaceAgentOfferable(agent, detectedAgentIds))
  if (detectedAgentIds === null) {
    return preferred &&
      isMobileTuiAgentEnabled(preferred, disabled) &&
      isWorkspaceAgentOfferable(preferred, null)
      ? preferred
      : (enabledAutoPickOrder[0] ?? 'blank')
  }
  return pickMobileTuiAgent(preferred, enabledAutoPickOrder, disabled) ?? 'blank'
}

export function filterWorkspaceAgents(agents: readonly TuiAgent[], disabled?: unknown): TuiAgent[] {
  return filterEnabledMobileTuiAgents(agents, disabled)
}

export function isWorkspaceAgentEnabled(agent: TuiAgent, disabled?: unknown): boolean {
  return isMobileTuiAgentEnabled(agent, disabled)
}

export function resolveWorkspaceAgentSelection({
  selectionActive,
  settings,
  detectedAgentIds,
  agent,
  overridden
}: ResolveWorkspaceAgentSelectionArgs): WorkspaceAgentSelectionState {
  const current = { agent, overridden }
  if (!selectionActive) {
    return current
  }

  const pickedAgent = pickWorkspaceAgent(settings, detectedAgentIds)
  if (!overridden) {
    return agent === pickedAgent ? current : { agent: pickedAgent, overridden: false }
  }

  if (
    !agent ||
    agent === 'blank' ||
    (isWorkspaceAgentOfferable(agent, detectedAgentIds) &&
      (detectedAgentIds === null || isWorkspaceAgentEnabled(agent, settings.disabledTuiAgents)))
  ) {
    return current
  }

  return { agent: pickedAgent, overridden: false }
}
