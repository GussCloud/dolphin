import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const deepseekCredentialsApi = {
  getStatus: () => ipcRenderer.invoke('deepseekCredentials:getStatus'),
  saveApiKey: (key: string) => ipcRenderer.invoke('deepseekCredentials:saveApiKey', key),
  clearApiKey: () => ipcRenderer.invoke('deepseekCredentials:clearApiKey'),
  listModels: () => ipcRenderer.invoke('deepseekCredentials:listModels')
} satisfies PreloadApi['deepseekCredentials']
