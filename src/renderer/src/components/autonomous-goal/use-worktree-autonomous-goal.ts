import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '@/store'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { getActiveRuntimeTarget } from '@/runtime/runtime-client-target'
import { isAutonomousGoalOpen, type AutonomousGoal } from '../../../../shared/autonomous-goal-types'

/** Slow on purpose: goal state changes at turn ends, and the strip is a glance, not a feed. */
const REFRESH_MS = 30_000

/** The newest open goal coordinated from this worktree, refreshed only while one is shown. */
export function useWorktreeAutonomousGoal(worktreeId: string | null): {
  goal: AutonomousGoal | null
  refresh: () => Promise<void>
  stop: (goalId: string) => Promise<void>
} {
  const environmentId = useAppStore((state) => state.settings?.activeRuntimeEnvironmentId ?? null)
  const [goal, setGoal] = useState<AutonomousGoal | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    if (!worktreeId) {
      setGoal(null)
      return
    }
    try {
      const { goals } = await callRuntimeRpc<{ goals: AutonomousGoal[] }>(
        getActiveRuntimeTarget({ activeRuntimeEnvironmentId: environmentId ?? undefined }),
        'goal.list',
        {}
      )
      setGoal(
        goals.findLast(
          (candidate) => candidate.worktreeId === worktreeId && isAutonomousGoalOpen(candidate)
        ) ?? null
      )
    } catch {
      // Why: an older host has no goal.list; no strip is the right answer there.
      setGoal(null)
    }
  }, [environmentId, worktreeId])

  const stop = useCallback(
    async (goalId: string): Promise<void> => {
      await callRuntimeRpc(
        getActiveRuntimeTarget({ activeRuntimeEnvironmentId: environmentId ?? undefined }),
        'goal.stop',
        { id: goalId }
      )
      await refresh()
    },
    [environmentId, refresh]
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  const hasOpenGoal = goal !== null
  useEffect(() => {
    if (!hasOpenGoal) {
      return
    }
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refresh()
      }
    }, REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [hasOpenGoal, refresh])

  return { goal, refresh, stop }
}
