import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const openObserveApi = {
  status: () => ipcRenderer.invoke('openObserve:status'),
  saveContext: (input) => ipcRenderer.invoke('openObserve:saveContext', input),
  activateContext: (name) => ipcRenderer.invoke('openObserve:activateContext', name)
} satisfies PreloadApi['openObserve']
