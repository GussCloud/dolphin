import { useEffect } from 'react'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { useAppStore } from '@/store'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { getActiveRuntimeTarget } from '@/runtime/runtime-client-target'
import {
  isAutonomousGoalOpen,
  type AutonomousGoalListEntry,
  type AutonomousGoalWorkerProgress
} from '../../../../shared/autonomous-goal-types'

/** Slow on purpose: goal state changes at turn ends, and these views are a glance, not a feed. */
const REFRESH_MS = 30_000

const goalIndexStore = createStore<{ goals: AutonomousGoalListEntry[] }>(() => ({ goals: [] }))

let subscribers = 0
let timer: number | null = null
let environmentId: string | null = null
let stopChangeEvents: (() => void) | null = null

export async function refreshAutonomousGoalIndex(): Promise<void> {
  try {
    const { goals } = await callRuntimeRpc<{ goals: AutonomousGoalListEntry[] }>(
      getActiveRuntimeTarget({ activeRuntimeEnvironmentId: environmentId ?? undefined }),
      'goal.list',
      {}
    )
    goalIndexStore.setState({ goals })
  } catch {
    // Why: an older host has no goal.list; showing no goal is the right answer there.
    goalIndexStore.setState({ goals: [] })
  }
}

function syncTimer(): void {
  const wanted = subscribers > 0 && goalIndexStore.getState().goals.some(isAutonomousGoalOpen)
  if (wanted && timer === null) {
    timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshAutonomousGoalIndex()
      }
    }, REFRESH_MS)
  } else if (!wanted && timer !== null) {
    window.clearInterval(timer)
    timer = null
  }
}

goalIndexStore.subscribe(syncTimer)

/** One shared `goal.list` poll for every view that shows goals; it runs only while one is open. */
export function useAutonomousGoalIndexPolling(): void {
  const activeEnvironmentId = useAppStore(
    (state) => state.settings?.activeRuntimeEnvironmentId ?? null
  )
  useEffect(() => {
    environmentId = activeEnvironmentId
    subscribers += 1
    // Why: a new goal starts with no open goal known, so no poll runs; the host's change event finds it.
    stopChangeEvents ??=
      window.api?.autonomousGoals?.onChanged(() => void refreshAutonomousGoalIndex()) ?? null
    void refreshAutonomousGoalIndex()
    return () => {
      subscribers -= 1
      if (subscribers === 0) {
        stopChangeEvents?.()
        stopChangeEvents = null
      }
      syncTimer()
    }
  }, [activeEnvironmentId])
}

/** The newest open goal this worktree coordinates. */
export function useCoordinatedAutonomousGoal(
  worktreeId: string | null
): AutonomousGoalListEntry | null {
  return useStore(goalIndexStore, (state) =>
    worktreeId
      ? (state.goals.findLast(
          (goal) => goal.worktreeId === worktreeId && isAutonomousGoalOpen(goal)
        ) ?? null)
      : null
  )
}

/** This worktree's newest goal when it completed and nothing newer is open: the kept coordinator. */
export function useCompletedAutonomousGoal(worktreeId: string): AutonomousGoalListEntry | null {
  return useStore(goalIndexStore, (state) => {
    const latest = state.goals.findLast((goal) => goal.worktreeId === worktreeId)
    return latest?.status === 'complete' ? latest : null
  })
}

/** This worktree's Task within an open goal, when a goal worker runs in it. */
export function useAutonomousGoalWorkerTask(
  worktreeId: string
): AutonomousGoalWorkerProgress | null {
  return useStore(goalIndexStore, (state) => {
    for (const goal of state.goals) {
      if (!isAutonomousGoalOpen(goal)) {
        continue
      }
      const worker = goal.progress?.workers.find((entry) => entry.worktreeId === worktreeId)
      if (worker) {
        return worker
      }
    }
    return null
  })
}

export async function stopAutonomousGoal(goalId: string): Promise<void> {
  await callRuntimeRpc(
    getActiveRuntimeTarget({ activeRuntimeEnvironmentId: environmentId ?? undefined }),
    'goal.stop',
    { id: goalId }
  )
  await refreshAutonomousGoalIndex()
}
