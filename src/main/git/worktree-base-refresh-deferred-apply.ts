import type { GitWorktreeExecOptions } from './worktree-operation-options'

export type LocalBaseRefRefreshPlan<T> = {
  result: T
  deferredMutation?: {
    start: () => Promise<unknown>
    /** Resolves to a skip reason when the planned mutation is no longer safe to apply. */
    revalidate: () => Promise<string | undefined>
    context: Record<string, string | undefined>
  }
}

// Why: a create that never releases its gate must not hold the repo's refresh chain forever.
export const LOCAL_BASE_REF_MUTATION_GATE_TIMEOUT_MS = 60_000

/**
 * Held by one create so its local base ref mutation starts only after that create's critical
 * path (checkout, startup terminals) is done. The owner must call `release()` in a `finally`.
 */
export class LocalBaseRefMutationGate {
  private open: () => void = () => {}
  private readonly opened = new Promise<void>((resolve) => {
    this.open = resolve
  })

  release(): void {
    this.open()
  }

  hold(): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, LOCAL_BASE_REF_MUTATION_GATE_TIMEOUT_MS)
      timer.unref?.()
    })
    return Promise.race([this.opened, timeout]).finally(() => clearTimeout(timer))
  }
}

// Tail of each repo's refresh chain; resolves once that refresh and its deferred mutation settle. Never rejects.
const refreshTails = new Map<string, Promise<void>>()
// Gates of each repo's queued or pending refreshes; a refresh queuing behind them releases them.
const queuedGates = new Map<string, Set<LocalBaseRefMutationGate>>()

export function localBaseRefRefreshQueueKey(
  repoPath: string,
  options: GitWorktreeExecOptions
): string {
  return JSON.stringify([options.wslDistro ?? null, repoPath])
}

/**
 * Runs `plan` after every earlier refresh of the same repo (including its deferred mutation) has
 * settled, then starts the plan's mutation without awaiting it — immediately, or once `gate`
 * releases and the plan's preconditions still hold.
 */
export async function runSerializedLocalBaseRefRefresh<T>(
  queueKey: string,
  plan: () => Promise<LocalBaseRefRefreshPlan<T>>,
  gate?: LocalBaseRefMutationGate
): Promise<T> {
  // Why: deferral must not make a later refresh (another create, or this create's fallback add)
  // wait out an earlier create's whole critical path — or deadlock on its own held mutation.
  const earlierGates = queuedGates.get(queueKey)
  earlierGates?.forEach((earlier) => earlier.release())
  if (gate) {
    const gates = earlierGates ?? new Set<LocalBaseRefMutationGate>()
    gates.add(gate)
    queuedGates.set(queueKey, gates)
  }
  const previous = refreshTails.get(queueKey)
  let settleTurn: () => void = () => {}
  const turn = new Promise<void>((resolve) => {
    settleTurn = resolve
  })
  const tail = previous ? previous.then(() => turn) : turn
  refreshTails.set(queueKey, tail)
  void turn.then(() => {
    const gates = queuedGates.get(queueKey)
    if (gate && gates?.delete(gate) && gates.size === 0) {
      queuedGates.delete(queueKey)
    }
  })
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
      // Why: ungated starts before returning so the status-check → mutation window stays narrow;
      // gated widens it, so it re-checks the plan's preconditions right before mutating.
      const applied = gate
        ? gate
            .hold()
            .then(deferredMutation.revalidate)
            .then((skipReason) => {
              if (skipReason) {
                console.warn('[worktree-base-refresh] deferred local base ref update skipped', {
                  ...deferredMutation.context,
                  reason: skipReason
                })
                return undefined
              }
              return deferredMutation.start()
            })
        : deferredMutation.start()
      // A late failure can only be logged: the create already reported 'updated' and the wire result is fixed.
      pendingMutation = applied.then(
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
