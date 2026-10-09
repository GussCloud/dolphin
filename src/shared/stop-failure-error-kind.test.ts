import { describe, expect, it } from 'vitest'
import {
  isDoneNoticeDeferredToAutoRetry,
  isRetryableAgentTurnFailure,
  readStopFailureErrorKind
} from './stop-failure-error-kind'

describe('StopFailure error kind', () => {
  it('keeps documented codes and folds anything else into unknown', () => {
    expect(readStopFailureErrorKind('server_error')).toBe('server_error')
    expect(readStopFailureErrorKind('billing_error')).toBe('billing_error')
    expect(readStopFailureErrorKind('API Error: Connection lost')).toBe('unknown')
    expect(readStopFailureErrorKind(undefined)).toBe('unknown')
  })

  it('retries only a classified network/server failure of a finished turn', () => {
    const failed = { state: 'done' as const, outcome: 'failure' as const, stateStartedAt: 1 }
    expect(isRetryableAgentTurnFailure({ ...failed, failureKind: 'server_error' })).toBe(true)
    expect(isRetryableAgentTurnFailure({ ...failed, failureKind: 'unknown' })).toBe(true)
    expect(isRetryableAgentTurnFailure({ ...failed, failureKind: 'rate_limit' })).toBe(false)
    // An older host that never classified the failure fails closed.
    expect(isRetryableAgentTurnFailure(failed)).toBe(false)
    expect(isRetryableAgentTurnFailure(undefined)).toBe(false)
  })

  it('defers done notices only while the setting is on (absent = default on)', () => {
    const mainAgent = {
      state: 'done' as const,
      outcome: 'failure' as const,
      failureKind: 'server_error' as const,
      stateStartedAt: 1
    }
    expect(isDoneNoticeDeferredToAutoRetry(mainAgent, undefined)).toBe(true)
    expect(isDoneNoticeDeferredToAutoRetry(mainAgent, true)).toBe(true)
    expect(isDoneNoticeDeferredToAutoRetry(mainAgent, false)).toBe(false)
  })
})
