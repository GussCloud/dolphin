// @ts-nocheck -- mechanically split from DolphinRuntimeService; behavior is covered by AST equivalence and characterization tests.
import { DolphinRuntimeWithStopExplicitlyClosedTabPtys } from './dolphin-runtime-stop-explicitly-closed-tab-ptys'
import type { TerminalPaneSplitSource } from '../../shared/feature-education-telemetry'
import type { RuntimeTerminalSplit } from '../../shared/runtime-types'
import type { RuntimePtyWorktreeRecord } from './runtime-terminal-state-records'
import { randomUUID } from 'node:crypto'

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
    } = {}
  ): Promise<RuntimeTerminalSplit> {
    const livePty = this.getLivePtyForHandle(handle)
    if (livePty) {
      return await this.splitPtyBackedTerminal(livePty.pty, opts)
    }
    if (opts.shellOverride) {
      // Why: the renderer split below drops env and shell, so it would run the command in the default shell.
      const sourcePty = this.getTerminalPtyRecordForHandle(handle)
      if (!sourcePty?.connected) {
        throw new Error('terminal_split_shell_override_requires_live_pty')
      }
      return await this.splitPtyBackedTerminal(sourcePty, opts)
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
      newLeafId
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
