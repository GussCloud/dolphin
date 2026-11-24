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

const PERIODIC_BUDGET_INTERVAL_MS = 5 * 60_000
// Why: an open popover polls the snapshot every few seconds and already logs its warnings.
const RECENT_BUDGET_EVALUATION_MS = 60_000
let lastBudgetEvaluatedAtMs = Number.NEGATIVE_INFINITY

export async function collectMemorySnapshotWithBudget(
  store: MemorySnapshotStore
): Promise<MemorySnapshot> {
  const snapshot = await collectMemorySnapshot(store)
  const budgetWarnings = evaluateMemoryBudget(snapshot, readMemoryBudget())
  budgetWarningLog.observe(budgetWarnings)
  lastBudgetEvaluatedAtMs = Date.now()
  return budgetWarnings.length > 0 ? { ...snapshot, budgetWarnings } : snapshot
}

/** Warn-only: logs over-budget owners even when no window is asking for snapshots. */
export function startPeriodicMemoryBudgetCheck(store: MemorySnapshotStore): () => void {
  let inFlight = false
  const timer = setInterval(() => {
    if (inFlight || Date.now() - lastBudgetEvaluatedAtMs < RECENT_BUDGET_EVALUATION_MS) {
      return
    }
    inFlight = true
    collectMemorySnapshotWithBudget(store)
      .catch(() => {
        // Why: the collector already degrades to an empty snapshot; nothing else to report.
      })
      .finally(() => {
        inFlight = false
      })
  }, PERIODIC_BUDGET_INTERVAL_MS)
  timer.unref?.()
  return () => clearInterval(timer)
}

export function registerMemoryHandlers(store: MemorySnapshotStore): void {
  ipcMain.handle('memory:getSnapshot', (): Promise<MemorySnapshot> =>
    collectMemorySnapshotWithBudget(store)
  )
  // Why: host totals only — no process-table sweep, so a periodic reader stays cheap.
  ipcMain.handle('memory:getHostMemory', (): Promise<HostMemory> => collectHostMemory())
}
