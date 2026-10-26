import { BrowserWindow } from 'electron'

const BROADCAST_DEBOUNCE_MS = 250

type ChangeSource = (notify: () => void) => () => void

/** Tells open windows that goals changed, so the sidebar re-reads `goal.list` instead of polling for new goals. */
export function startAutonomousGoalRendererBroadcast(sources: ChangeSource[]): () => void {
  let timer: NodeJS.Timeout | null = null
  const notify = (): void => {
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
  }
  const unsubscribes = sources.map((subscribe) => subscribe(notify))
  return () => {
    for (const unsubscribe of unsubscribes) {
      unsubscribe()
    }
    if (timer) {
      clearTimeout(timer)
    }
  }
}
