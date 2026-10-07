import type { MobileUncaughtErrorKind } from './mobile-crash-session'

type GlobalErrorHandler = (error: unknown, isFatal?: boolean) => void

export type GlobalErrorUtilsPort = {
  getGlobalHandler: () => GlobalErrorHandler
  setGlobalHandler: (handler: GlobalErrorHandler) => void
}

type PromiseRejectionTrackerOptions = {
  allRejections: boolean
  onUnhandled: (id: number, error: unknown) => void
}

export type PromiseRejectionTrackerPort = (options: PromiseRejectionTrackerOptions) => void

type GlobalErrorCaptureOptions = {
  errorUtils: GlobalErrorUtilsPort | null
  enableRejectionTracker: PromiseRejectionTrackerPort | null
  record: (error: unknown, kind: MobileUncaughtErrorKind) => Promise<void>
  /** Caps how long a fatal waits for the journal write before the previous handler crashes us. */
  fatalFlushTimeoutMs?: number
}

const DEFAULT_FATAL_FLUSH_TIMEOUT_MS = 1000

/** Journals errors thrown outside render; the previous handler still runs, so RN's crash path is unchanged. */
export function installMobileGlobalErrorCapture(options: GlobalErrorCaptureOptions): void {
  const { errorUtils, enableRejectionTracker, record } = options
  const flushTimeoutMs = options.fatalFlushTimeoutMs ?? DEFAULT_FATAL_FLUSH_TIMEOUT_MS
  const safeRecord = (error: unknown, kind: MobileUncaughtErrorKind): Promise<void> => {
    try {
      return record(error, kind).catch(() => undefined)
    } catch {
      return Promise.resolve()
    }
  }

  if (errorUtils) {
    const previous = errorUtils.getGlobalHandler()
    errorUtils.setGlobalHandler((error, isFatal) => {
      const recorded = safeRecord(error, isFatal ? 'fatal' : 'non_fatal')
      if (!isFatal) {
        previous(error, isFatal)
        return
      }
      // Why: a release fatal kills the JS thread inside `previous`, before an async write lands.
      let settled = false
      const forward = (): void => {
        if (!settled) {
          settled = true
          previous(error, isFatal)
        }
      }
      setTimeout(forward, flushTimeoutMs)
      void recorded.then(forward)
    })
  }

  enableRejectionTracker?.({
    allRejections: true,
    onUnhandled: (_id, error) => {
      void safeRecord(error, 'unhandled_rejection')
    }
  })
}

/** The slice of the Hermes runtime global this module uses. */
export type HermesInternalPort = {
  enablePromiseRejectionTracker?: PromiseRejectionTrackerPort
}

/** Hermes' tracker replaces RN's dev one (LogBox warnings), so only claim it outside dev. */
export function resolveReleaseRejectionTracker(
  hermesInternal: HermesInternalPort | null | undefined,
  isDev: boolean
): PromiseRejectionTrackerPort | null {
  const enable = hermesInternal?.enablePromiseRejectionTracker
  if (isDev || typeof enable !== 'function') {
    return null
  }
  return (trackerOptions) => {
    enable.call(hermesInternal, trackerOptions)
  }
}
