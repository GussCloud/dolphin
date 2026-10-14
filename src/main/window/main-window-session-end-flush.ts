import { recordDurableCrashBreadcrumb } from '../crash-reporting/durable-crash-breadcrumb'
import { flushStagedStateWithDeadline } from '../ipc/renderer-shutdown-checkpoint'
import type { Store } from '../persistence'

type SessionEndSignal = 'query-session-end' | 'session-end'
type SessionEndWindow = { on(event: SessionEndSignal, listener: () => void): unknown }

// Why: Windows logoff/update kills the app before before-quit runs, so the debounced store write
// (e.g. a just-finished agent's resume record) would be lost. Best-effort: never vetoes the OS.
export function installWindowsSessionEndFlush(
  mainWindow: SessionEndWindow,
  store: Pick<Store, 'flushPendingOrThrowAsync'> | null
): void {
  if (process.platform !== 'win32' || !store) {
    return
  }
  let inFlight: Promise<void> | null = null
  const flush = (signal: SessionEndSignal): void => {
    // Why: query-session-end and session-end arrive back to back; one flush covers both.
    if (inFlight) {
      return
    }
    inFlight = flushStagedStateWithDeadline(store)
      .then(({ ok }) => {
        if (!ok) {
          recordDurableCrashBreadcrumb('system_session_end_flush_failed', { signal })
        }
      })
      .finally(() => {
        inFlight = null
      })
  }
  mainWindow.on('query-session-end', () => flush('query-session-end'))
  mainWindow.on('session-end', () => flush('session-end'))
}
