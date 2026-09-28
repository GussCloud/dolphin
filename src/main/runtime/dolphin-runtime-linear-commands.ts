// @ts-nocheck -- mechanically split from DolphinRuntimeService; behavior is covered by AST equivalence and characterization tests.
import { DolphinRuntimeWithFileCommands } from './dolphin-runtime-file-commands'
import { RuntimeLinearCommands } from './runtime-linear-connection-commands'

export class DolphinRuntimeWithLinearCommands extends DolphinRuntimeWithFileCommands {
  // ── Linear integration ──

  readonly linearCommands = new RuntimeLinearCommands({
    runtimeAvailable: () => this.store !== null,
    showTerminal: (handle) => this.showTerminal(handle),
    resolveWorktreeSelector: (selector) => this.resolveWorktreeSelector(selector),
    listResolvedWorktrees: () => this.listResolvedWorktrees(),
    setWorktreeMeta: (worktreeId, meta) => this.store!.setWorktreeMeta(worktreeId, meta),
    emitClientEvent: (event) => this.emitClientEvent(event)
  })
}
