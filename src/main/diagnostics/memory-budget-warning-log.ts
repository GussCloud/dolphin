import type { MemoryBudgetWarning } from '../../shared/process-stats-types'

const MB = 1024 * 1024

export type MemoryBudgetWarningLogEntry = {
  state: 'over' | 'cleared'
  kind: MemoryBudgetWarning['kind']
  subject: string
  /** Absent on 'cleared': the owner's current size is no longer evaluated as a warning. */
  megabytes?: number
  limitMegabytes: number
}

/**
 * Transition log for budget warnings: an owner is logged when it goes over and again when it
 * clears, never on every snapshot it stays over. Why transitions: the Resource Manager polls
 * every 2 s while open, and a repeated line per poll would drown the trace log.
 */
export function createMemoryBudgetWarningLog(emit: (entry: MemoryBudgetWarningLogEntry) => void): {
  observe: (warnings: readonly MemoryBudgetWarning[]) => void
} {
  let over = new Map<string, MemoryBudgetWarning>()
  return {
    observe(warnings) {
      const next = new Map<string, MemoryBudgetWarning>()
      for (const warning of warnings) {
        const key = `${warning.kind}\u0000${warning.subject}`
        next.set(key, warning)
        if (!over.has(key)) {
          emit({
            state: 'over',
            kind: warning.kind,
            subject: warning.subject,
            megabytes: Math.round(warning.bytes / MB),
            limitMegabytes: Math.round(warning.limitBytes / MB)
          })
        }
      }
      for (const [key, warning] of over) {
        if (!next.has(key)) {
          emit({
            state: 'cleared',
            kind: warning.kind,
            subject: warning.subject,
            limitMegabytes: Math.round(warning.limitBytes / MB)
          })
        }
      }
      over = next
    }
  }
}
