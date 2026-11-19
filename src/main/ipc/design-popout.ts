import { app, ipcMain } from 'electron'
import type { Store } from '../persistence'
import type { KeybindingService } from '../keybindings/keybinding-service'
import {
  createOrFocusDesignPopout,
  getDesignPopoutWindow,
  isDesignPopoutRenderer
} from '../window/design-popout-window'
import { safelyRevealWindow } from '../window/focus-existing-window'
import { isBackgroundLaunch } from '../window/foreground-activation-policy'
import { getTrustedUIRendererWindow, isTrustedUIRenderer } from './ui'
import {
  isDesignPopoutOpenComposerArgs,
  isDesignPopoutRevealWorktreeArgs
} from '../../shared/design-popout'

// Why: both actions need surfaces only the main window has (composer, workspace
// panes), so the Design window hands them over and the main window comes forward.
function forwardToMainWindow(channel: string, args: unknown): void {
  const mainWindow = getTrustedUIRendererWindow()
  if (!mainWindow) {
    return
  }
  safelyRevealWindow(mainWindow)
  mainWindow.webContents.send(channel, args)
  if (!isBackgroundLaunch()) {
    try {
      app.focus({ steal: true })
    } catch {
      // Best-effort; the per-window focus above may still bring it forward.
    }
  }
}

export function registerDesignPopoutHandlers(store: Store, keybindings?: KeybindingService): void {
  ipcMain.removeHandler('designPopout:open')
  ipcMain.removeHandler('designPopout:getOpen')
  ipcMain.removeHandler('designPopout:openComposer')
  ipcMain.removeHandler('designPopout:revealWorktree')

  ipcMain.handle('designPopout:open', (event): void => {
    if (!isTrustedUIRenderer(event.sender)) {
      return
    }
    createOrFocusDesignPopout(store, { getKeybindings: () => keybindings?.getOverrides() })
  })

  ipcMain.handle('designPopout:getOpen', (event): boolean =>
    isTrustedUIRenderer(event.sender) ? getDesignPopoutWindow() !== null : false
  )

  ipcMain.handle('designPopout:openComposer', (event, args: unknown): void => {
    if (!isDesignPopoutRenderer(event.sender) || !isDesignPopoutOpenComposerArgs(args)) {
      return
    }
    forwardToMainWindow('ui:designPopoutOpenComposer', args)
  })

  ipcMain.handle('designPopout:revealWorktree', (event, args: unknown): void => {
    if (!isDesignPopoutRenderer(event.sender) || !isDesignPopoutRevealWorktreeArgs(args)) {
      return
    }
    forwardToMainWindow('ui:designPopoutRevealWorktree', args)
  })
}
