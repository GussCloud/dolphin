import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  installMobileGlobalErrorCapture,
  resolveReleaseRejectionTracker,
  type GlobalErrorUtilsPort,
  type PromiseRejectionTrackerPort
} from './mobile-global-error-capture'

function fakeErrorUtils(previous: (error: unknown, isFatal?: boolean) => void) {
  let handler = previous
  const port: GlobalErrorUtilsPort = {
    getGlobalHandler: () => handler,
    setGlobalHandler: (next) => {
      handler = next
    }
  }
  return {
    port,
    fire: (error: unknown, isFatal?: boolean) => handler(error, isFatal)
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('installMobileGlobalErrorCapture', () => {
  it('journals a non-fatal error and chains the previous handler synchronously', () => {
    const previous = vi.fn()
    const record = vi.fn().mockResolvedValue(undefined)
    const utils = fakeErrorUtils(previous)
    installMobileGlobalErrorCapture({
      errorUtils: utils.port,
      enableRejectionTracker: null,
      record
    })

    const error = new Error('soft')
    utils.fire(error, false)

    expect(record).toHaveBeenCalledWith(error, 'non_fatal')
    expect(previous).toHaveBeenCalledWith(error, false)
  })

  it('lets a fatal journal write land before the previous handler runs', async () => {
    const previous = vi.fn()
    let finish: () => void = () => undefined
    const record = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)))
    const utils = fakeErrorUtils(previous)
    installMobileGlobalErrorCapture({
      errorUtils: utils.port,
      enableRejectionTracker: null,
      record
    })

    utils.fire(new Error('fatal'), true)
    expect(record).toHaveBeenCalledWith(expect.any(Error), 'fatal')
    expect(previous).not.toHaveBeenCalled()

    finish()
    await vi.waitFor(() => expect(previous).toHaveBeenCalledTimes(1))
  })

  it('still crashes through the previous handler when the journal write hangs or throws', async () => {
    vi.useFakeTimers()
    const previous = vi.fn()
    const utils = fakeErrorUtils(previous)
    installMobileGlobalErrorCapture({
      errorUtils: utils.port,
      enableRejectionTracker: null,
      record: () => new Promise<void>(() => undefined),
      fatalFlushTimeoutMs: 500
    })

    utils.fire(new Error('fatal'), true)
    await vi.advanceTimersByTimeAsync(500)
    expect(previous).toHaveBeenCalledTimes(1)

    const throwing = fakeErrorUtils(vi.fn())
    installMobileGlobalErrorCapture({
      errorUtils: throwing.port,
      enableRejectionTracker: null,
      record: () => {
        throw new Error('storage gone')
      }
    })
    expect(() => throwing.fire(new Error('x'), false)).not.toThrow()
  })

  it('journals unhandled promise rejections through the tracker', () => {
    const record = vi.fn().mockResolvedValue(undefined)
    let onUnhandled: ((id: number, error: unknown) => void) | null = null
    const tracker: PromiseRejectionTrackerPort = (options) => {
      expect(options.allRejections).toBe(true)
      onUnhandled = options.onUnhandled
    }
    installMobileGlobalErrorCapture({
      errorUtils: null,
      enableRejectionTracker: tracker,
      record
    })

    onUnhandled?.(1, 'nope')
    expect(record).toHaveBeenCalledWith('nope', 'unhandled_rejection')
  })
})

describe('resolveReleaseRejectionTracker', () => {
  it('uses Hermes only outside dev so LogBox keeps its own tracker', () => {
    const enablePromiseRejectionTracker = vi.fn()
    const hermes = { enablePromiseRejectionTracker }
    expect(resolveReleaseRejectionTracker(hermes, true)).toBeNull()
    expect(resolveReleaseRejectionTracker(null, false)).toBeNull()
    expect(resolveReleaseRejectionTracker({}, false)).toBeNull()

    const tracker = resolveReleaseRejectionTracker(hermes, false)
    const options = { allRejections: true, onUnhandled: () => undefined }
    tracker?.(options)
    expect(enablePromiseRejectionTracker).toHaveBeenCalledWith(options)
  })
})
