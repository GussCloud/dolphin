import { useAppStore } from '@/store'
import type { AgentCompletionStatusSnapshot } from '@/components/terminal-pane/agent-completion-coordinator-types'
import { isDoneNoticeDeferredToAutoRetry } from '../../../shared/stop-failure-error-kind'

// Why: main's connection-loss auto-retry owns these failed turns and raises its own exhausted notice.
const deferredPaneKeys = new Set<string>()

/** Tracks the pane's latest hook row so a completion dispatched without a snapshot can still defer. */
export function recordAutoRetryDeferral(
  paneKey: string,
  payload: AgentCompletionStatusSnapshot
): void {
  if (isDoneNoticeDeferredToAutoRetry(payload.mainAgent, true)) {
    deferredPaneKeys.add(paneKey)
  } else {
    deferredPaneKeys.delete(paneKey)
  }
}

export function forgetAutoRetryDeferral(paneKey?: string): void {
  if (paneKey === undefined) {
    deferredPaneKeys.clear()
  } else {
    deferredPaneKeys.delete(paneKey)
  }
}

export function isCompletionDeferredToAutoRetry(
  paneKey: string,
  snapshot: AgentCompletionStatusSnapshot | undefined
): boolean {
  const enabled = useAppStore.getState().settings?.claudeAutoRetryOnConnectionLoss
  return snapshot
    ? isDoneNoticeDeferredToAutoRetry(snapshot.mainAgent, enabled)
    : enabled !== false && deferredPaneKeys.has(paneKey)
}
