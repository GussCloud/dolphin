import type { AgentStatusEntry } from '../../../shared/agent-status-types'
import type { SleepingAgentSessionRecord } from '../../../shared/agent-session-resume'
import type { GlobalSettings } from '../../../shared/global-settings-types'
import type { TerminalLayoutSnapshot, TerminalTab } from '../../../shared/terminal-tab-types'
import type { HostMemoryPressureLevel } from './agent-hibernation-memory-pressure'

export type AgentHibernationPlannerSnapshot = {
  settings: Pick<GlobalSettings, 'experimentalAgentHibernation' | 'agentHibernationIdleMs'> | null
  activeWorktreeId: string | null
  foregroundTerminalTabIds: string[]
  tabsByWorktree: Record<string, TerminalTab[]>
  terminalLayoutsByTabId: Record<string, TerminalLayoutSnapshot | undefined>
  ptyIdsByTabId: Record<string, string[] | undefined>
  runtimeLivePtyIdsByWorktreeId?: Record<string, string[] | undefined>
  runtimeLivenessRequiredWorktreeIds?: string[]
  mobileLockedPtyIds: string[]
  agentStatusByPaneKey: Record<string, AgentStatusEntry | undefined>
  sleepingAgentSessionsByPaneKey: Record<string, SleepingAgentSessionRecord | undefined>
  lastTerminalInputAtByPaneKey: Record<string, number | undefined>
  foregroundTerminalLastSeenAtByTabId: Record<string, number | undefined>
  ptyBindingFirstSeenAtByPaneKey?: Record<string, number | undefined>
  boundaryResolvedAtByPaneKey?: Record<string, number | undefined>
  hostMemoryPressureLevel?: HostMemoryPressureLevel
  /** Worktrees whose agents run on this host — the only ones its memory pressure may shorten. */
  hostLocalWorktreeIds?: string[]
  now: number
}
