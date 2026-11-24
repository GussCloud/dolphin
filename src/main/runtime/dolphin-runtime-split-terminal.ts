// @ts-nocheck -- mechanically split from DolphinRuntimeService; behavior is covered by AST equivalence and characterization tests.
import { DolphinRuntimeWithStopExplicitlyClosedTabPtys } from './dolphin-runtime-stop-explicitly-closed-tab-ptys'
import type { TerminalPaneSplitSource } from '../../shared/feature-education-telemetry'
import type { RuntimeTerminalSplit } from '../../shared/runtime-types'
import type { TuiAgent } from '../../shared/tui-agent'
import type { RuntimePtyWorktreeRecord } from './runtime-terminal-state-records'
import { randomUUID } from 'node:crypto'

let warnedAgentTeammateRendererSplit = false

function warnAgentTeammateRendererSplitOnce(): void {
  if (warnedAgentTeammateRendererSplit) {
    return
  }
  warnedAgentTeammateRendererSplit = true
  console.warn(
    '[agent-teams] terminal_split_agent_teammate_requires_live_pty: falling back to a renderer split without team env'
  )
}

export class DolphinRuntimeWithSplitTerminal extends DolphinRuntimeWithStopExplicitlyClosedTabPtys {
  async splitTerminal(
    handle: string,
    opts: {
      direction?: 'horizontal' | 'vertical'
      command?: string
      env?: Record<string, string>
      envToDelete?: string[]
      activate?: boolean
      // Why: same split as createTerminal — adopt the pane without revealing its
      // workspace, for splits the user never asked to see.
      surfaceOwner?: false
      telemetrySource?: TerminalPaneSplitSource
      shellOverride?: string
      /** Agent-teams teammate panes only; see PtySpawnOptions.gitBashStartupCommandInArgs. */
      gitBashStartupCommandInArgs?: boolean
      /** Agent-teams teammate panes only: the leader leaf the renderer re-balances around. */
      agentTeamLeaderLeafId?: string
      /** Agent-teams teammate pane: spawned main-side so its team env survives, with a minted launch token. */
      agentTeammate?: { launchAgent: TuiAgent }
    } = {}
  ): Promise<RuntimeTerminalSplit> {
    const livePty = this.getLivePtyForHandle(handle)
    if (livePty) {
      return await this.splitPtyBackedTerminal(livePty.pty, opts)
    }
    if (opts.shellOverride || opts.agentTeammate) {
      // Why: the renderer split below drops env and shell, so it would run the command in the default shell.
      const sourcePty = this.getTerminalPtyRecordForHandle(handle)
      if (sourcePty?.connected) {
        return await this.splitPtyBackedTerminal(sourcePty, opts)
      }
      if (opts.shellOverride) {
        throw new Error('terminal_split_shell_override_requires_live_pty')
      }
      // Why: a teammate without team env still beats no teammate; this was the only path before.
      warnAgentTeammateRendererSplitOnce()
    }
    this.assertGraphReady()
    const { leaf } = this.getLiveLeafForHandle(handle)
    const direction = opts.direction ?? 'horizontal'

    const newLeafId = randomUUID()

    this.notifier?.splitTerminal(leaf.tabId, leaf.paneRuntimeId, {
      direction,
      command: opts.command,
      worktreeId: leaf.worktreeId,
      sourceLeafId: leaf.leafId,
      telemetrySource: opts.telemetrySource,
      newLeafId,
      ...(opts.agentTeamLeaderLeafId ? { agentTeamLeaderLeafId: opts.agentTeamLeaderLeafId } : {})
    })

    const newHandle = await this.waitForLeafInTab(leaf.tabId, newLeafId)
    return {
      handle: newHandle,
      tabId: leaf.tabId,
      paneRuntimeId: leaf.paneRuntimeId,
      leafId: newLeafId
    }
  }

  /** The PTY behind a handle, whether runtime-owned or a renderer leaf. */
  protected getTerminalPtyRecordForHandle(handle: string): RuntimePtyWorktreeRecord | null {
    const livePty = this.getLivePtyForHandle(handle)
    if (livePty) {
      return livePty.pty
    }
    const ptyId = this.handles.get(handle)?.ptyId
    return ptyId ? (this.ptysById.get(ptyId) ?? null) : null
  }
}
