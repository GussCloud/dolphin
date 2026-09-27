import type { MemorySnapshot } from '../../shared/process-stats-types'
import type { MemoryBudgetWarning } from '../../shared/runtime-diagnostics-types'

const MB = 1024 * 1024

export type MemoryBudget = {
  rendererBytes: number
  sessionBytes: number
  daemonBytes: number
}

export const DEFAULT_MEMORY_BUDGET: MemoryBudget = {
  rendererBytes: 1500 * MB,
  sessionBytes: 1024 * MB,
  daemonBytes: 512 * MB
}

function readMegabytes(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const parsed = Number(env[name])
  return Number.isFinite(parsed) && parsed > 0 ? parsed * MB : fallback
}

export function readMemoryBudget(env: NodeJS.ProcessEnv = process.env): MemoryBudget {
  return {
    rendererBytes: readMegabytes(
      env,
      'ORCA_WARN_RENDERER_MEMORY_MB',
      DEFAULT_MEMORY_BUDGET.rendererBytes
    ),
    sessionBytes: readMegabytes(
      env,
      'ORCA_WARN_SESSION_MEMORY_MB',
      DEFAULT_MEMORY_BUDGET.sessionBytes
    ),
    daemonBytes: readMegabytes(env, 'ORCA_WARN_DAEMON_MEMORY_MB', DEFAULT_MEMORY_BUDGET.daemonBytes)
  }
}

/** Warnings only: an over-budget agent may be doing real work, so nothing here stops it. */
export function evaluateMemoryBudget(
  snapshot: MemorySnapshot,
  budget: MemoryBudget
): MemoryBudgetWarning[] {
  const warnings: MemoryBudgetWarning[] = []
  if (snapshot.app.renderer.memory > budget.rendererBytes) {
    warnings.push({
      kind: 'renderer',
      subject: 'renderer',
      bytes: snapshot.app.renderer.memory,
      limitBytes: budget.rendererBytes
    })
  }
  if (snapshot.daemon && snapshot.daemon.memory > budget.daemonBytes) {
    warnings.push({
      kind: 'daemon',
      subject: `pid ${snapshot.daemon.pid}`,
      bytes: snapshot.daemon.memory,
      limitBytes: budget.daemonBytes
    })
  }
  for (const worktree of snapshot.worktrees) {
    for (const session of worktree.sessions) {
      // Why commit when present: a trimmed working set hides the memory that drives paging.
      const bytes = Math.max(session.memory, session.privateMemory ?? 0)
      if (bytes > budget.sessionBytes) {
        warnings.push({
          kind: 'session',
          subject: `${worktree.worktreeName} / ${session.sessionId}`,
          bytes,
          limitBytes: budget.sessionBytes
        })
      }
    }
  }
  return warnings
}
