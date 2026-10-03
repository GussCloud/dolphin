import { describeUnconfirmedAgentStop } from '../../shared/pty-liveness-verdict'
import type { AgentTeamHostShell } from './claude-agent-teams-host-shell'
import {
  defaultPaneCommandScriptDir,
  removePaneCommandScript,
  writePaneCommandScript
} from './claude-agent-teams-pane-command-script'
import {
  resolveSpawnOrigin,
  resolveSplitTarget,
  teammatePaneSpawnOptions,
  updateMainVerticalAfterSplit
} from './claude-agent-teams-pane-layout'
import type { AgentTeam, AgentTeamsTerminalApi, TeamPane } from './claude-agent-teams-types'

// Why: Claude's holding pane; tmux runs it only to be replaced by `respawn-pane -k`.
const HOLDING_PANE_COMMAND = 'cat'

/** Creates, respawns and removes teammate panes; owns their Git Bash command scripts. */
export class ClaudeAgentTeamsPaneLifecycle {
  constructor(private readonly paneCommandScriptDir: string = defaultPaneCommandScriptDir()) {}

  /** Deletes scripts of panes whose typed `.` line never ran; call when the team goes away. */
  async releaseTeam(team: AgentTeam): Promise<void> {
    await Promise.all([...team.panes.values()].map((pane) => this.releasePaneScript(pane)))
  }

  async split(
    team: AgentTeam,
    targetPane: TeamPane,
    horizontal: boolean,
    command: string,
    api: AgentTeamsTerminalApi
  ): Promise<TeamPane> {
    const hostShell = this.resolveHostShell(team, api)
    const fakePaneId = `%${team.nextPaneNumber}`
    team.nextPaneNumber += 1
    const splitTarget = resolveSplitTarget(team, targetPane, horizontal)
    const pane: TeamPane = {
      fakePaneId,
      handle: null,
      index: team.paneOrder.length,
      splitFromPane: splitTarget.pane.fakePaneId,
      splitDirection: splitTarget.direction
    }
    // Why: a Git Bash pane costs seconds to start, so the `cat` holding pane stays pending
    // (no PTY) until respawn-pane brings the real command; that also avoids the dead pane
    // Windows leaves when a killed placeholder exits non-zero.
    if (hostShell !== 'native-windows-git-bash' || command !== HOLDING_PANE_COMMAND) {
      await this.spawn(team, pane, command, hostShell, api)
    }
    team.panes.set(fakePaneId, pane)
    team.paneOrder.push(fakePaneId)
    updateMainVerticalAfterSplit(team, fakePaneId, splitTarget)
    return pane
  }

  // Why: Claude Code's pane backend creates a teammate pane in two steps — it
  // splits a holding pane running `cat`, then `respawn-pane -k`s it with the
  // real teammate command. Dolphin panes are PTYs that cannot swap their program in
  // place, so we honor respawn by closing the placeholder terminal (if one was
  // spawned) and splitting from the same origin with the real command, keeping the
  // fake pane id stable so later send-keys/kill-pane/list-panes still resolve.
  async respawn(
    team: AgentTeam,
    pane: TeamPane,
    command: string,
    api: AgentTeamsTerminalApi
  ): Promise<void> {
    if (pane.respawnBlockedReason) {
      throw new Error(pane.respawnBlockedReason)
    }
    const hostShell = this.resolveHostShell(team, api)
    if (pane.handle !== null) {
      const close = await api.closeTerminal(pane.handle)
      if (!close.ptyKilled) {
        pane.respawnBlockedReason = describeUnconfirmedAgentStop(close)
        throw new Error(pane.respawnBlockedReason)
      }
      pane.handle = null
      await this.releasePaneScript(pane)
    }
    try {
      await this.spawn(team, pane, command, hostShell, api)
    } catch (error) {
      this.remove(team, pane)
      throw error
    }
  }

  async kill(team: AgentTeam, pane: TeamPane, api: AgentTeamsTerminalApi): Promise<void> {
    if (pane.handle !== null) {
      const close = await api.closeTerminal(pane.handle)
      if (!close.ptyKilled) {
        throw new Error(describeUnconfirmedAgentStop(close))
      }
    }
    await this.releasePaneScript(pane)
    this.remove(team, pane)
  }

  private async spawn(
    team: AgentTeam,
    pane: TeamPane,
    command: string,
    hostShell: AgentTeamHostShell,
    api: AgentTeamsTerminalApi
  ): Promise<void> {
    const origin = resolveSpawnOrigin(team, pane)
    const script =
      hostShell === 'native-windows-git-bash' && command
        ? await writePaneCommandScript(this.paneCommandScriptDir, command)
        : null
    try {
      const split = await api.splitTerminal(origin.handle, {
        direction: origin.direction,
        command: (script ? script.typedCommand : command) || undefined,
        ...(script ? { gitBashStartupCommandInArgs: true } : {}),
        ...teammatePaneSpawnOptions(team, hostShell, pane.fakePaneId),
        activate: false
      })
      pane.handle = split.handle
      api.markTeammatePaneNotResumable(split.handle)
      pane.commandScriptPath = script?.filePath
    } catch (error) {
      await removePaneCommandScript(script?.filePath)
      throw error
    }
  }

  private async releasePaneScript(pane: TeamPane): Promise<void> {
    const scriptPath = pane.commandScriptPath
    pane.commandScriptPath = undefined
    await removePaneCommandScript(scriptPath)
  }

  private remove(team: AgentTeam, pane: TeamPane): void {
    team.panes.delete(pane.fakePaneId)
    team.paneOrder = team.paneOrder.filter((id) => id !== pane.fakePaneId)
    if (team.mainVertical?.lastColumnPane === pane.fakePaneId) {
      team.mainVertical.lastColumnPane =
        [...team.paneOrder].toReversed().find((id) => id !== team.leaderPane) ?? null
    }
  }

  private resolveHostShell(team: AgentTeam, api: AgentTeamsTerminalApi): AgentTeamHostShell {
    team.hostShell ??= api.resolveHostShell(team.leaderHandle)
    if (!team.hostShell) {
      throw new Error('cannot determine the leader terminal shell host')
    }
    return team.hostShell
  }
}
