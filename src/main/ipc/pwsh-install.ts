import { ipcMain } from 'electron'
import type { PwshInstallResult } from '../../shared/pwsh-install'
import { cancelPwshInstall, installPwshWithWinget } from '../pwsh-install'
import { isTrustedUIRenderer } from './ui'

export function registerPwshInstallHandlers(): void {
  ipcMain.removeHandler('pwsh:install')
  ipcMain.removeHandler('pwsh:cancelInstall')

  // Why trusted-only: this installs software on the user's machine; no guest or pop-out page may trigger it.
  ipcMain.handle('pwsh:install', (event): Promise<PwshInstallResult> => {
    if (!isTrustedUIRenderer(event.sender)) {
      return Promise.resolve({ status: 'unsupported' })
    }
    return installPwshWithWinget()
  })
  ipcMain.handle('pwsh:cancelInstall', (event): void => {
    if (isTrustedUIRenderer(event.sender)) {
      cancelPwshInstall()
    }
  })
}
