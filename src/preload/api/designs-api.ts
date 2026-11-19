import type {
  DesignPopoutOpenComposerArgs,
  DesignPopoutRevealWorktreeArgs
} from '../../shared/design-popout'

export type DesignsApi = {
  /** Fires when this host's design store changes; the renderer re-reads `design.list`. */
  onChanged: (callback: () => void) => () => void
  openPopout: () => Promise<void>
  getPopoutOpen: () => Promise<boolean>
  onPopoutOpenChanged: (callback: (open: boolean) => void) => () => void
  onOpenComposerRequested: (callback: (args: DesignPopoutOpenComposerArgs) => void) => () => void
  onRevealWorktreeRequested: (
    callback: (args: DesignPopoutRevealWorktreeArgs) => void
  ) => () => void
  openComposerInMain: (args: DesignPopoutOpenComposerArgs) => Promise<void>
  revealWorktreeInMain: (args: DesignPopoutRevealWorktreeArgs) => Promise<void>
}
