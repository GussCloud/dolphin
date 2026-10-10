import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'
import type { PwshInstallResult } from '../../shared/pwsh-install'

export const pwshApi = {
  isAvailable: (): Promise<boolean> => ipcRenderer.invoke('pwsh:isAvailable'),
  installSupported: process.platform === 'win32',
  install: (): Promise<PwshInstallResult> => ipcRenderer.invoke('pwsh:install'),
  cancelInstall: (): Promise<void> => ipcRenderer.invoke('pwsh:cancelInstall')
} satisfies PreloadApi['pwsh']
