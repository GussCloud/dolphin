import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const azureDevOpsApi = {
  setAuthMethod: (method) => ipcRenderer.invoke('azureDevOps:setAuthMethod', method),
  configureCliDefaults: (args) => ipcRenderer.invoke('azureDevOps:configureCliDefaults', args),
  setCliAutoRenew: (enabled) => ipcRenderer.invoke('azureDevOps:setCliAutoRenew', enabled),
  refreshCliSession: () => ipcRenderer.invoke('azureDevOps:refreshCliSession'),
  listRepositories: () => ipcRenderer.invoke('azureDevOps:listRepositories')
} satisfies PreloadApi['azureDevOps']
