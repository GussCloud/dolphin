// Agent turn recovery: when a Claude lead turn ends on a lost API connection (retryable
// StopFailure), type `continue` for the user with backoff, and notify once retries are exhausted.
import type { EnrichedAgentHookEventPayload } from '../agent-hooks/server/server-types'
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
  /** The pane's live terminal handle (local or SSH), or null once it is gone. */
  resolveTerminalHandle: (paneKey: string, reported: string | undefined) => string | null
  /** Last user keystroke on the terminal's PTY; undefined when unknown (e.g. no local PTY). */
  readLastInputAt: (terminal: string) => number | undefined
  sendText: (terminal: string, text: string) => Promise<AgentPaneTextResult>
  notifyExhausted: (event: ClaudeConnectionLossExhaustedEvent) => void
  schedule?: (run: () => void, ms: number) => () => void
}

/** Per-pane aggregate: retries spent on the current user turn and the one pending, if any. */
type PaneRetryState = {
  attempts: number
  worktreeId?: string
  /** `mainAgent.stateStartedAt` of the failure already handled, so a restated row is not a new failure. */
  failureStamp?: number
  pending?: { cancel: () => void; terminal: string; inputSnapshot: number | undefined }
  /** Our own `continue` is in flight; its UserPromptSubmit must not reset the turn's budget. */
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
    const terminal = ports.resolveTerminalHandle(paneKey, pending.terminal)
    // Why: the user typed since the failure (or the pane is gone) — they own the turn now.
    if (!terminal || ports.readLastInputAt(terminal) !== pending.inputSnapshot) {
      panes.delete(paneKey)
      return
    }
    pane.attempts += 1
    pane.awaitingOwnPrompt = true
    let result: AgentPaneTextResult
    try {
      result = await ports.sendText(terminal, CLAUDE_CONNECTION_LOSS_RETRY_TEXT)
    } catch {
      result = 'unknown'
    }
    if (panes.get(paneKey) !== pane || result === 'accepted') {
      return
    }
    if (result === 'no-agent') {
      // The agent left its prompt (exited or busy elsewhere); nothing to resume.
      panes.delete(paneKey)
      return
    }
    // Why: 'unknown' on SSH is unverifiable, never proof the agent died — hand the turn back to the user.
    exhaust(paneKey, pane)
  }

  function onFailure(enriched: EnrichedAgentHookEventPayload, failureStamp: number): void {
    const paneKey = enriched.paneKey
    const pane: PaneRetryState = panes.get(paneKey) ?? {
      attempts: 0,
      awaitingOwnPrompt: false,
      exhausted: false
    }
    panes.set(paneKey, pane)
    pane.failureStamp = failureStamp
    pane.awaitingOwnPrompt = false
    if (enriched.worktreeId) {
      pane.worktreeId = enriched.worktreeId
    }
    if (pane.exhausted) {
      return
    }
    const delay = CLAUDE_CONNECTION_LOSS_RETRY_BACKOFF_MS[pane.attempts]
    const terminal = ports.resolveTerminalHandle(paneKey, enriched.terminalHandle)
    if (delay === undefined || !terminal) {
      exhaust(paneKey, pane)
      return
    }
    const inputSnapshot = ports.readLastInputAt(terminal)
    const cancel = schedule(() => void fire(paneKey, pane), delay)
    pane.pending = { cancel, terminal, inputSnapshot }
  }

  function onStatus(enriched: EnrichedAgentHookEventPayload): void {
    // Lead events only: a child's turn end or tool traffic never owns the lead's recovery.
    if (
      enriched.isReplay === true ||
      enriched.providerSessionOnly === true ||
      enriched.source !== 'claude' ||
      enriched.toolAgentId !== undefined
    ) {
      return
    }
    const paneKey = enriched.paneKey
    const pane = panes.get(paneKey)
    const mainAgent = enriched.payload.mainAgent
    const isFailure = enriched.hookEventName === 'StopFailure'
    if (isFailure && pane?.failureStamp === mainAgent?.stateStartedAt) {
      return
    }
    cancelPending(pane)
    if (isFailure && mainAgent && isRetryableAgentTurnFailure(mainAgent)) {
      if (ports.isEnabled()) {
        onFailure(enriched, mainAgent.stateStartedAt)
      } else {
        panes.delete(paneKey)
      }
      return
    }
    if (enriched.hookEventName === 'UserPromptSubmit' && pane?.awaitingOwnPrompt) {
      pane.awaitingOwnPrompt = false
      return
    }
    // A clean Stop, a non-retryable failure, or a prompt the user typed starts a fresh budget.
    if (
      isFailure ||
      enriched.hookEventName === 'Stop' ||
      enriched.hookEventName === 'UserPromptSubmit'
    ) {
      panes.delete(paneKey)
    }
  }

  const disposers = [
    ports.subscribeEnrichedStatus(onStatus),
    ports.subscribeStatusDrop(forget),
    ports.subscribePaneStatusClear((clear) => {
      if ('paneKey' in clear) {
        forget(clear.paneKey)
      }
    })
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
