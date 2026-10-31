import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'
import {
  AZURE_CLI_SIGN_IN_STATE_CHANNEL,
  type AzureCliSignInState
} from '../../shared/azure-devops-auth'

export const azureDevOpsApi = {
  setAuthMethod: (method) => ipcRenderer.invoke('azureDevOps:setAuthMethod', method),
  configureCliDefaults: (args) => ipcRenderer.invoke('azureDevOps:configureCliDefaults', args),
  setCliAutoRenew: (enabled) => ipcRenderer.invoke('azureDevOps:setCliAutoRenew', enabled),
  refreshCliSession: () => ipcRenderer.invoke('azureDevOps:refreshCliSession'),
  listRepositories: () => ipcRenderer.invoke('azureDevOps:listRepositories'),
  pullRequestBoard: () => ipcRenderer.invoke('azureDevOps:pullRequestBoard'),
  pullRequestComments: (args) => ipcRenderer.invoke('azureDevOps:pullRequestComments', args),
  reviewerAvatar: (url) => ipcRenderer.invoke('azureDevOps:reviewerAvatar', url),
  orgLink: (args) => ipcRenderer.invoke('azureDevOps:orgLink', args),
  getCliSignInState: () => ipcRenderer.invoke('azureDevOps:getCliSignInState'),
  startCliSignIn: (mode) => ipcRenderer.invoke('azureDevOps:startCliSignIn', mode),
  cancelCliSignIn: () => ipcRenderer.invoke('azureDevOps:cancelCliSignIn'),
  onCliSignInStateChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: AzureCliSignInState): void =>
      callback(state)
    ipcRenderer.on(AZURE_CLI_SIGN_IN_STATE_CHANNEL, listener)
    return () => ipcRenderer.removeListener(AZURE_CLI_SIGN_IN_STATE_CHANNEL, listener)
  }
} satisfies PreloadApi['azureDevOps']
