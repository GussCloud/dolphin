import { ipcRenderer } from 'electron'
import type { HostMemory, MemorySnapshot } from '../../shared/process-stats-types'
import type { PreloadApi } from '../api-types'

export const memoryApi = {
  getSnapshot: (): Promise<MemorySnapshot> => ipcRenderer.invoke('memory:getSnapshot'),
  getHostMemory: (): Promise<HostMemory | null> => ipcRenderer.invoke('memory:getHostMemory')
} satisfies PreloadApi['memory']
