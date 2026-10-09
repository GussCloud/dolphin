// Agent turn recovery: when a Claude lead turn ends on a lost API connection (retryable
// StopFailure), type `continue` for the user with backoff, and notify once retries are exhausted.
import type { EnrichedAgentHookEventPayload } from '../agent-hooks/server/server-types'
import { isChildAttributedHookEvent } from '../agent-hooks/server/server-child-attribution'
import type { AgentStatusClearIpcPayload } from '../../shared/agent-status-types'
import {
  isDoneNoticeDeferredToAutoRetry,
  isRetryableAgentTurnFailure
} from '../../shared/stop-failure-error-kind'
import type { AgentPaneTextResult } from '../agent-pane-text-delivery'
import type { TelegramNoticeFilter } from '../telegram/telegram-notice-delivery'

export const CLAUDE_CONNECTION_LOSS_RETRY_BACKOFF_MS = [5_000, 15_000, 45_000] as const
export const CLAUDE_CONNECTION_LOSS_RETRY_TEXT = 'continue'

export type ClaudeConnectionLossExhaustedEvent = {
  paneKey: string
  worktreeId?: string
  attempts: number
}

export type ClaudeConnectionLossRetryPorts = {
  subscribeEnrichedStatus: (
    listener: (payload: EnrichedAgentHookEventPayload) => void
  ) => () => void
  subscribeStatusDrop: (listener: (paneKey: string) => void) => () => void
  subscribePaneStatusClear: (listener: (clear: AgentStatusClearIpcPayload) => void) => () => void
  isEnabled: () => boolean
  /** The pane's live terminal handle (local or SSH), or null when the runtime has none. */
  resolveTerminalHandle: (paneKey: string) => string | null
  /** Last user input on the terminal's PTY from any surface; undefined when unknown. */
  readLastInputAt: (terminal: string) => number | undefined
  sendText: (terminal: string, text: string) => Promise<AgentPaneTextResult>
  notifyExhausted: (event: ClaudeConnectionLossExhaustedEvent) => void
  schedule?: (run: () => void, ms: number) => () => void
}

/** Per-pane aggregate: retries spent on the current user turn and the one pending, if any. */
type PaneRetryState = {
  attempts: number
  worktreeId?: string
  connectionId: string | null
  /** `mainAgent.stateStartedAt` of the failure already handled, so a restated row is not a new failure. */
  failureStamp?: number
  pending?: { cancel: () => void; inputSnapshot: number | undefined }
  /** Our `continue` is being typed right now. */
  inFlight: boolean
  /** Our `continue` was typed; its UserPromptSubmit must not reset the turn's budget. */
  awaitingOwnPrompt: boolean
  exhausted: boolean
}

/** Telegram's done notice for a failed turn waits on the retry; exhaustion sends its own notice. */
export function createAutoRetryDoneNoticeFilter(isEnabled: () => boolean): TelegramNoticeFilter {
  return (notice, entry) =>
    notice.kind !== 'done' || !isDoneNoticeDeferredToAutoRetry(entry.mainAgent, isEnabled())
}

function defaultSchedule(run: () => void, ms: number): () => void {
  const timer = setTimeout(run, ms)
  return () => clearTimeout(timer)
}

export function startClaudeConnectionLossRetry(ports: ClaudeConnectionLossRetryPorts): () => void {
  const schedule = ports.schedule ?? defaultSchedule
  const panes = new Map<string, PaneRetryState>()

  function cancelPending(pane: PaneRetryState | undefined): void {
    pane?.pending?.cancel()
    if (pane) {
      pane.pending = undefined
    }
  }

  function forget(paneKey: string): void {
    cancelPending(panes.get(paneKey))
    panes.delete(paneKey)
  }

  function exhaust(paneKey: string, pane: PaneRetryState): void {
    cancelPending(pane)
    pane.awaitingOwnPrompt = false
    if (pane.exhausted) {
      return
    }
    pane.exhausted = true
    ports.notifyExhausted({
      paneKey,
      ...(pane.worktreeId ? { worktreeId: pane.worktreeId } : {}),
      attempts: pane.attempts
    })
  }

  /** Lost contact with a pane that still owes a retry: unverifiable, so the user must hear of it. */
  function abandon(paneKey: string): void {
    const pane = panes.get(paneKey)
    if (pane && (pane.pending || pane.inFlight)) {
      exhaust(paneKey, pane)
    }
    forget(paneKey)
  }

  async function fire(paneKey: string, pane: PaneRetryState): Promise<void> {
    const pending = pane.pending
    pane.pending = undefined
    if (!pending || panes.get(paneKey) !== pane) {
      return
    }
    if (!ports.isEnabled()) {
      panes.delete(paneKey)
      return
    }
    const terminal = ports.resolveTerminalHandle(paneKey)
    if (!terminal) {
      exhaust(paneKey, pane)
      return
    }
    // Why: the user typed since the failure (desktop, phone or paired client) — they own the turn now.
    if (ports.readLastInputAt(terminal) !== pending.inputSnapshot) {
      panes.delete(paneKey)
      return
    }
    pane.attempts += 1
    pane.awaitingOwnPrompt = true
    pane.inFlight = true
    let result: AgentPaneTextResult
    try {
      result = await ports.sendText(terminal, CLAUDE_CONNECTION_LOSS_RETRY_TEXT)
    } catch {
      result = 'unknown'
    }
    pane.inFlight = false
    if (panes.get(paneKey) !== pane || result === 'accepted') {
      return
    }
    // Why: no-agent/unknown are unverifiable (on SSH never proof of death) and the done notice is held — hand the turn back.
    exhaust(paneKey, pane)
  }

  function onFailure(enriched: EnrichedAgentHookEventPayload, failureStamp: number): void {
    const paneKey = enriched.paneKey
    const pane: PaneRetryState = panes.get(paneKey) ?? {
      attempts: 0,
      connectionId: null,
      inFlight: false,
      awaitingOwnPrompt: false,
      exhausted: false
    }
    panes.set(paneKey, pane)
    pane.failureStamp = failureStamp
    pane.awaitingOwnPrompt = false
    pane.connectionId = enriched.connectionId
    if (enriched.worktreeId) {
      pane.worktreeId = enriched.worktreeId
    }
    if (pane.exhausted) {
      return
    }
    const delay = CLAUDE_CONNECTION_LOSS_RETRY_BACKOFF_MS[pane.attempts]
    const terminal = ports.resolveTerminalHandle(paneKey)
    if (delay === undefined || !terminal) {
      exhaust(paneKey, pane)
      return
    }
    const inputSnapshot = ports.readLastInputAt(terminal)
    const cancel = schedule(() => void fire(paneKey, pane), delay)
    pane.pending = { cancel, inputSnapshot }
  }

  function onStatus(enriched: EnrichedAgentHookEventPayload): void {
    // Lead events only: a child's turn end, idle or tool traffic never owns the lead's recovery.
    if (
      enriched.isReplay === true ||
      enriched.providerSessionOnly === true ||
      enriched.source !== 'claude' ||
      isChildAttributedHookEvent(enriched)
    ) {
      return
    }
    const paneKey = enriched.paneKey
    const pane = panes.get(paneKey)
    const mainAgent = enriched.payload.mainAgent
    switch (enriched.hookEventName ?? '') {
      case 'StopFailure': {
        if (pane && mainAgent && pane.failureStamp === mainAgent.stateStartedAt) {
          return
        }
        cancelPending(pane)
        if (mainAgent && isRetryableAgentTurnFailure(mainAgent) && ports.isEnabled()) {
          onFailure(enriched, mainAgent.stateStartedAt)
        } else {
          panes.delete(paneKey)
        }
        return
      }
      case 'UserPromptSubmit': {
        cancelPending(pane)
        if (
          pane?.awaitingOwnPrompt &&
          enriched.payload.prompt.trim() === CLAUDE_CONNECTION_LOSS_RETRY_TEXT
        ) {
          pane.awaitingOwnPrompt = false
          return
        }
        // A prompt the user typed starts a fresh budget.
        panes.delete(paneKey)
        return
      }
      case 'Stop':
      case 'SessionStart':
        forget(paneKey)
        return
      default:
        // Why: other lead traffic (restated rows, compaction) leaves the failed idle prompt alone
        // unless the main agent is working again.
        if (pane?.pending && mainAgent && mainAgent.state !== 'done') {
          forget(paneKey)
        }
    }
  }

  function onPaneClear(clear: AgentStatusClearIpcPayload): void {
    if ('paneKey' in clear) {
      // The pane or its worktree was closed: nobody is waiting on it.
      forget(clear.paneKey)
      return
    }
    // A host connection dropped: its panes are unverifiable, not exited.
    for (const [paneKey, pane] of panes) {
      if (pane.connectionId === clear.connectionId) {
        abandon(paneKey)
      }
    }
  }

  const disposers = [
    ports.subscribeEnrichedStatus(onStatus),
    ports.subscribeStatusDrop(abandon),
    ports.subscribePaneStatusClear(onPaneClear)
  ]
  return () => {
    for (const dispose of disposers) {
      dispose()
    }
    for (const paneKey of panes.keys()) {
      forget(paneKey)
    }
  }
}
