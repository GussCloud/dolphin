import { ipcRenderer } from 'electron'
import type {
  DesignPopoutOpenComposerArgs,
  DesignPopoutRevealWorktreeArgs
} from '../../shared/design-popout'
import type { PreloadApi } from '../api-types'

function subscribe<T>(channel: string, callback: (args: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, args: T): void => callback(args)
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

export const designsApi = {
  onChanged: (callback: () => void): (() => void) => subscribe('designs:changed', () => callback()),

  // ── Main window: open the Design pop-out and serve its hand-offs ─────
  openPopout: (): Promise<void> => ipcRenderer.invoke('designPopout:open'),
  getPopoutOpen: (): Promise<boolean> => ipcRenderer.invoke('designPopout:getOpen'),
  onPopoutOpenChanged: (callback: (open: boolean) => void): (() => void) =>
    subscribe('designPopout:openChanged', callback),
  onOpenComposerRequested: (callback: (args: DesignPopoutOpenComposerArgs) => void): (() => void) =>
    subscribe('ui:designPopoutOpenComposer', callback),
  onRevealWorktreeRequested: (
    callback: (args: DesignPopoutRevealWorktreeArgs) => void
  ): (() => void) => subscribe('ui:designPopoutRevealWorktree', callback),

  // ── Design pop-out: hand actions back to the main window ─────────────
  openComposerInMain: (args: DesignPopoutOpenComposerArgs): Promise<void> =>
    ipcRenderer.invoke('designPopout:openComposer', args),
  revealWorktreeInMain: (args: DesignPopoutRevealWorktreeArgs): Promise<void> =>
    ipcRenderer.invoke('designPopout:revealWorktree', args)
} satisfies PreloadApi['designs']
