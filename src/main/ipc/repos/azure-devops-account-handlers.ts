import { BrowserWindow, ipcMain } from 'electron'
import type { Store } from '../../persistence'
import { isAzureCliSignInMode } from '../../../shared/azure-devops-auth'
import type { AzureDevOpsManagedAccount } from '../../../shared/source-control-account-types'
import {
  addAzureDevOpsManagedAccount,
  removeAzureDevOpsManagedAccount,
  type AddAzureDevOpsManagedAccountResult
} from '../../azure-devops/azure-devops-managed-account-commands'
import { listAzureDevOpsManagedAccounts } from '../../azure-devops/azure-devops-managed-accounts'
import { notifyReposChanged } from './repos-changed-notification'

const CHANNELS = [
  'azureDevOps:listManagedAccounts',
  'azureDevOps:addManagedAccount',
  'azureDevOps:removeManagedAccount'
] as const

// Why desktop-only (no RPC): the isolated `az login` opens its sign-in window on this desktop.
export function registerAzureDevOpsManagedAccountHandlers(
  mainWindow: BrowserWindow,
  store: Store
): void {
  for (const channel of CHANNELS) {
    ipcMain.removeHandler(channel)
  }
  ipcMain.handle('azureDevOps:listManagedAccounts', (): AzureDevOpsManagedAccount[] =>
    listAzureDevOpsManagedAccounts()
  )
  ipcMain.handle(
    'azureDevOps:addManagedAccount',
    (event, mode: unknown): Promise<AddAzureDevOpsManagedAccountResult> => {
      if (!isAzureCliSignInMode(mode)) {
        return Promise.resolve({ ok: false, error: 'Invalid Azure CLI sign-in mode' })
      }
      return addAzureDevOpsManagedAccount(mode, {
        parent: BrowserWindow.fromWebContents(event.sender)
      })
    }
  )
  ipcMain.handle(
    'azureDevOps:removeManagedAccount',
    (_event, id: unknown): { ok: true } | { ok: false; error: string } => {
      if (typeof id !== 'string') {
        return { ok: false, error: 'Invalid account id' }
      }
      const result = removeAzureDevOpsManagedAccount(store, id)
      if (!result.ok) {
        return result
      }
      if (result.unboundRepoIds.length > 0) {
        notifyReposChanged(mainWindow)
      }
      return { ok: true }
    }
  )
}
