import { BrowserWindow } from 'electron'
import type { AutonomousGoal } from '../../shared/autonomous-goal-types'

const BROADCAST_DEBOUNCE_MS = 250

/** Tells open windows that goals changed, so the sidebar re-reads `goal.list` instead of polling for new goals. */
export function startAutonomousGoalRendererBroadcast(
  subscribe: (listener: (goal: AutonomousGoal) => void) => () => void
): () => void {
  let timer: NodeJS.Timeout | null = null
  const unsubscribe = subscribe(() => {
    if (timer) {
      return
    }
    timer = setTimeout(() => {
      timer = null
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) {
          window.webContents.send('autonomousGoals:changed')
        }
      }
    }, BROADCAST_DEBOUNCE_MS)
  })
  return () => {
    unsubscribe()
    if (timer) {
      clearTimeout(timer)
    }
  }
}
