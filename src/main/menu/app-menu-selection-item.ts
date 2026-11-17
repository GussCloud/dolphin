import { BrowserWindow, Menu, webContents } from 'electron'
import { isAzureDevOpsSignInWindow } from '../azure-devops/azure-devops-sign-in-window'

export type AppMenuSelectionAction = 'copy' | 'select-all'

export function createAppMenuSelectionItem({
  action,
  label,
  isMac
}: {
  action: AppMenuSelectionAction
  label: string
  isMac: boolean
}): Electron.MenuItemConstructorOptions {
  return {
    label,
    ...(isMac ? { accelerator: action === 'copy' ? 'Command+C' : 'Command+A' } : {}),
    click: () => {
      const focusedWindow = BrowserWindow.getFocusedWindow()
      if (focusedWindow) {
        const focusedContents = webContents.getFocusedWebContents()
        // Why: the Azure sign-in page has no Dolphin listener for the selection IPC.
        const nativeTarget = isAzureDevOpsSignInWindow(focusedWindow)
          ? focusedWindow.webContents
          : focusedContents && focusedContents !== focusedWindow.webContents
            ? focusedContents
            : null
        if (nativeTarget) {
          if (action === 'copy') {
            nativeTarget.copy()
          } else {
            nativeTarget.selectAll()
          }
          return
        }
        focusedWindow.webContents.send('ui:appMenuSelectionAction', action)
        return
      }
      if (isMac) {
        Menu.sendActionToFirstResponder(action === 'copy' ? 'copy:' : 'selectAll:')
      }
    }
  }
}
