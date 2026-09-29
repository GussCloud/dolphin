import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const azureBoardsApi = {
  scope: () => ipcRenderer.invoke('azureBoards:scope'),
  list: (args) => ipcRenderer.invoke('azureBoards:list', args),
  get: (args) => ipcRenderer.invoke('azureBoards:get', args),
  types: (args) => ipcRenderer.invoke('azureBoards:types', args),
  create: (args) => ipcRenderer.invoke('azureBoards:create', args),
  updateState: (args) => ipcRenderer.invoke('azureBoards:updateState', args),
  addComment: (args) => ipcRenderer.invoke('azureBoards:addComment', args)
} satisfies PreloadApi['azureBoards']
