import type { AgentMainAgentStatus } from './main-agent-status'

/** Claude's documented StopFailure `error` codes. A classification code, never provider text. */
export const STOP_FAILURE_ERROR_KINDS = [
  'rate_limit',
  'authentication_failed',
  'billing_error',
  'invalid_request',
  'server_error',
  'max_output_tokens',
  'unknown'
] as const
export type StopFailureErrorKind = (typeof STOP_FAILURE_ERROR_KINDS)[number]

export function isStopFailureErrorKind(value: unknown): value is StopFailureErrorKind {
  return STOP_FAILURE_ERROR_KINDS.some((known) => known === value)
}

/** Allowlist a lead StopFailure's `error`; anything unrecognized (or absent) is `unknown`. */
export function readStopFailureErrorKind(value: unknown): StopFailureErrorKind {
  return isStopFailureErrorKind(value) ? value : 'unknown'
}

/** Network/server faults only; quota, auth, billing, bad requests and token caps never fix themselves. */
export function isRetryableStopFailure(kind: StopFailureErrorKind | undefined): boolean {
  return kind === 'server_error' || kind === 'unknown'
}

/** A finished main-agent turn that failed in a way auto-retry may recover. Absent kind (older
 *  host) is not retryable, so mixed versions fail closed. */
export function isRetryableAgentTurnFailure(mainAgent: AgentMainAgentStatus | undefined): boolean {
  return (
    mainAgent?.state === 'done' &&
    mainAgent.outcome === 'failure' &&
    mainAgent.failureKind !== undefined &&
    isRetryableStopFailure(mainAgent.failureKind)
  )
}

/** While auto-retry owns a retryable failure, the usual "done" notices stay quiet; the retry
 *  either resumes the turn or raises its own exhausted notice. `undefined` setting = default on. */
export function isDoneNoticeDeferredToAutoRetry(
  mainAgent: AgentMainAgentStatus | undefined,
  autoRetryEnabled: boolean | undefined
): boolean {
  return autoRetryEnabled !== false && isRetryableAgentTurnFailure(mainAgent)
}
