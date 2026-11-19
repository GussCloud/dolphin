import { BrowserWindow } from 'electron'

const BROADCAST_DEBOUNCE_MS = 250

type ChangeSource = (notify: () => void) => () => void

/** Tells open windows that designs changed, so the Design page re-reads `design.list` instead of polling. */
export function startDesignRendererBroadcast(
  source: ChangeSource,
  /** Also told on each flush: paired clients, which have no IPC channel. */
  publishToClients: () => void = () => {}
): () => void {
  let timer: NodeJS.Timeout | null = null
  const notify = (): void => {
    if (timer) {
      return
    }
    timer = setTimeout(() => {
      timer = null
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) {
          window.webContents.send('designs:changed')
        }
      }
      publishToClients()
    }, BROADCAST_DEBOUNCE_MS)
  }
  const unsubscribe = source(notify)
  return () => {
    unsubscribe()
    if (timer) {
      clearTimeout(timer)
    }
  }
}
