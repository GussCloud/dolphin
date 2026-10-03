import { ipcMain } from 'electron'
import type { HostMemory, MemorySnapshot } from '../../shared/process-stats-types'
import { collectMemorySnapshot, type MemorySnapshotStore } from '../memory/collector'
import { collectHostMemory } from '../memory/host-memory'

export function registerMemoryHandlers(store: MemorySnapshotStore): void {
  ipcMain.handle('memory:getSnapshot', (): Promise<MemorySnapshot> => collectMemorySnapshot(store))
  // Why: host totals only — no process-table sweep, so a periodic reader stays cheap.
  ipcMain.handle('memory:getHostMemory', (): Promise<HostMemory> => collectHostMemory())
}
