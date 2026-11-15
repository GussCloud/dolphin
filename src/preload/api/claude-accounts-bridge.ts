import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const claudeAccountsApi = {
  list: () => ipcRenderer.invoke('claudeAccounts:list'),
  add: (args?: { runtime?: 'host' | 'wsl'; wslDistro?: string | null }) =>
    ipcRenderer.invoke('claudeAccounts:add', args),
  discoverFolders: () => ipcRenderer.invoke('claudeAccounts:discoverFolders'),
  linkFolder: (args: { configDir: string }) =>
    ipcRenderer.invoke('claudeAccounts:linkFolder', args),
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke('claudeAccounts:pickFolder'),
  profile: (args: { accountId: string }) => ipcRenderer.invoke('claudeAccounts:profile', args),
  saveProfileInstructions: (args: { accountId: string; content: string }) =>
    ipcRenderer.invoke('claudeAccounts:saveProfileInstructions', args),
  markProfileReviewed: (args: { accountId: string }) =>
    ipcRenderer.invoke('claudeAccounts:markProfileReviewed', args),
  importIntoProfile: (args: { accountId: string; ids: string[] }) =>
    ipcRenderer.invoke('claudeAccounts:importIntoProfile', args),
  cancelPendingLogin: (): Promise<boolean> =>
    ipcRenderer.invoke('claudeAccounts:cancelPendingLogin'),
  reauthenticate: (args: { accountId: string }) =>
    ipcRenderer.invoke('claudeAccounts:reauthenticate', args),
  remove: (args: { accountId: string }) => ipcRenderer.invoke('claudeAccounts:remove', args),
  select: (args: {
    accountId: string | null
    runtime?: 'host' | 'wsl'
    wslDistro?: string | null
  }) => ipcRenderer.invoke('claudeAccounts:select', args)
} satisfies PreloadApi['claudeAccounts']
