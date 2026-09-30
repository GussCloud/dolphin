import { teammatePaneShellOverride, type AgentTeamHostShell } from './claude-agent-teams-host-shell'
import type { AgentTeam, TeamPane } from './claude-agent-teams-types'

export type SplitTarget = { pane: TeamPane; direction: 'horizontal' | 'vertical' }

export function paneEnv(team: AgentTeam, fakePaneId: string): Record<string, string> {
  return {
    ...team.baseEnv,
    TMUX_PANE: fakePaneId,
    DOLPHIN_AGENT_TEAMS_LEADER_PANE: team.leaderPane
  }
}

export function teammatePaneSpawnOptions(
  team: AgentTeam,
  hostShell: AgentTeamHostShell,
  fakePaneId: string
): { env: Record<string, string>; envToDelete: string[]; shellOverride?: string } {
  const shellOverride = teammatePaneShellOverride(hostShell)
  return {
    // Why: no MSYS2_ARG_CONV_EXCL/MSYS_NO_PATHCONV — they would leak into every command the
    // teammate's Bash tool runs, and MSYS leaves the command's `C:\` paths alone anyway.
    env: paneEnv(team, fakePaneId),
    envToDelete: ['TERM_PROGRAM'],
    ...(shellOverride ? { shellOverride } : {})
  }
}

export function resolveSplitTarget(
  team: AgentTeam,
  targetPane: TeamPane,
  horizontal: boolean
): SplitTarget {
  if (horizontal && team.mainVertical?.lastColumnPane) {
    return {
      pane: team.panes.get(team.mainVertical.lastColumnPane) ?? targetPane,
      direction: 'horizontal'
    }
  }
  // Why: tmux `split-window -h` means left/right panes; Dolphin names that
  // layout by the vertical divider it creates.
  return { pane: targetPane, direction: horizontal ? 'vertical' : 'horizontal' }
}

/**
 * The nearest spawned ancestor to split a pane from, and the direction that keeps it in the
 * column Claude intended when its recorded origin is itself still pending.
 */
export function resolveSpawnOrigin(
  team: AgentTeam,
  pane: TeamPane
): { handle: string; direction: 'horizontal' | 'vertical' } {
  let direction = pane.splitDirection ?? 'horizontal'
  let origin = pane.splitFromPane ? team.panes.get(pane.splitFromPane) : undefined
  const visited = new Set([pane.fakePaneId])
  while (origin && origin.handle === null && !visited.has(origin.fakePaneId)) {
    visited.add(origin.fakePaneId)
    direction = origin.splitDirection ?? direction
    origin = origin.splitFromPane ? team.panes.get(origin.splitFromPane) : undefined
  }
  const handle = origin?.handle ?? team.panes.get(team.leaderPane)?.handle ?? team.leaderHandle
  return { handle, direction }
}

export function updateMainVerticalAfterSplit(
  team: AgentTeam,
  fakePaneId: string,
  splitTarget: SplitTarget
): void {
  if (team.mainVertical) {
    team.mainVertical.lastColumnPane = fakePaneId
  } else if (
    splitTarget.direction === 'vertical' &&
    splitTarget.pane.fakePaneId === team.leaderPane
  ) {
    team.mainVertical = { mainPane: team.leaderPane, lastColumnPane: fakePaneId }
  }
}

export function formatContext(team: AgentTeam, pane: TeamPane): Record<string, string> {
  return {
    session_name: team.sessionName,
    session_id: '$0',
    window_id: '@0',
    window_index: team.windowIndex,
    window_name: 'agent-teams',
    window_active: '1',
    window_flags: '*',
    pane_id: pane.fakePaneId,
    pane_index: String(pane.index),
    pane_active: pane.fakePaneId === team.leaderPane ? '1' : '0',
    pane_title: '',
    pane_width: '',
    pane_height: '',
    pane_left: '',
    pane_top: '',
    window_width: '',
    window_height: ''
  }
}
