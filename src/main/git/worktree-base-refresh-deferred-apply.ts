import type { GitWorktreeExecOptions } from './worktree-operation-options'

export type LocalBaseRefRefreshPlan<T> = {
  result: T
  deferredMutation?: {
    start: () => Promise<unknown>
    context: Record<string, string | undefined>
  }
}

// Tail of each repo's refresh chain; resolves once that refresh and its deferred mutation settle. Never rejects.
const refreshTails = new Map<string, Promise<void>>()

export function localBaseRefRefreshQueueKey(
  repoPath: string,
  options: GitWorktreeExecOptions
): string {
  return JSON.stringify([options.wslDistro ?? null, repoPath])
}

/**
 * Runs `plan` after every earlier refresh of the same repo (including its deferred mutation) has
 * settled, then starts the plan's mutation without awaiting it.
 */
export async function runSerializedLocalBaseRefRefresh<T>(
  queueKey: string,
  plan: () => Promise<LocalBaseRefRefreshPlan<T>>
): Promise<T> {
  const previous = refreshTails.get(queueKey)
  let settleTurn: () => void = () => {}
  const turn = new Promise<void>((resolve) => {
    settleTurn = resolve
  })
  const tail = previous ? previous.then(() => turn) : turn
  refreshTails.set(queueKey, tail)
  void tail.then(() => {
    if (refreshTails.get(queueKey) === tail) {
      refreshTails.delete(queueKey)
    }
  })

  let pendingMutation: Promise<void> | undefined
  try {
    if (previous) {
      await previous
    }
    const { result, deferredMutation } = await plan()
    if (deferredMutation) {
      // Why: started before returning so the status-check → mutation window stays as narrow as before.
      // A late failure can only be logged: the create already reported 'updated' and the wire result is fixed.
      pendingMutation = deferredMutation.start().then(
        () => undefined,
        (error: unknown) => {
          console.warn('[worktree-base-refresh] deferred local base ref update failed', {
            ...deferredMutation.context,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      )
    }
    return result
  } finally {
    if (pendingMutation) {
      void pendingMutation.then(settleTurn)
    } else {
      settleTurn()
    }
  }
}

export async function _awaitPendingLocalBaseRefRefreshesForTests(): Promise<void> {
  while (refreshTails.size > 0) {
    await Promise.all(refreshTails.values())
  }
}
