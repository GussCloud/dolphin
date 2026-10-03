import { ipcMain } from 'electron'
import type { HostMemory, MemorySnapshot } from '../../shared/process-stats-types'
import { collectMemorySnapshot, type MemorySnapshotStore } from '../memory/collector'
import { collectHostMemory } from '../memory/host-memory'
import { evaluateMemoryBudget, readMemoryBudget } from '../diagnostics/memory-budget'
import { createMemoryBudgetWarningLog } from '../diagnostics/memory-budget-warning-log'
import { startSpan } from '../observability/tracer'

// Why a span: main.trace.ndjson is main's only on-disk log and it ships in support bundles.
const budgetWarningLog = createMemoryBudgetWarningLog((entry) => {
  startSpan('memory.budget-warning', { attributes: { ...entry } }).end()
  if (entry.state === 'over') {
    console.warn(
      `[memory-budget] ${entry.kind} ${entry.subject} over budget: ${entry.megabytes} MB > ${entry.limitMegabytes} MB`
    )
  }
})

export async function collectMemorySnapshotWithBudget(
  store: MemorySnapshotStore
): Promise<MemorySnapshot> {
  const snapshot = await collectMemorySnapshot(store)
  const budgetWarnings = evaluateMemoryBudget(snapshot, readMemoryBudget())
  budgetWarningLog.observe(budgetWarnings)
  return budgetWarnings.length > 0 ? { ...snapshot, budgetWarnings } : snapshot
}

export function registerMemoryHandlers(store: MemorySnapshotStore): void {
  ipcMain.handle('memory:getSnapshot', (): Promise<MemorySnapshot> =>
    collectMemorySnapshotWithBudget(store)
  )
  // Why: host totals only — no process-table sweep, so a periodic reader stays cheap.
  ipcMain.handle('memory:getHostMemory', (): Promise<HostMemory> => collectHostMemory())
}
