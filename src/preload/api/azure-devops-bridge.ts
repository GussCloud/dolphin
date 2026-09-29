import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const azureDevOpsApi = {
  setAuthMethod: (method) => ipcRenderer.invoke('azureDevOps:setAuthMethod', method),
  configureCliDefaults: (args) => ipcRenderer.invoke('azureDevOps:configureCliDefaults', args),
  refreshCliSession: () => ipcRenderer.invoke('azureDevOps:refreshCliSession')
} satisfies PreloadApi['azureDevOps']
