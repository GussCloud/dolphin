// Per-pane transition detection over the agent status store's enriched fan-out.
// Decides only; the bridge performs the Telegram I/O and reports back what it sent.
import type { EnrichedAgentHookEventPayload } from '../agent-hooks/server/server-types'
import type { AgentStatusEntry } from '../../shared/agent-status-types'
import { reserveNotificationCooldown } from '../../shared/notification-burst-cooldown'
import { telegramNoticeKindFor, type TelegramNoticeKind } from './telegram-agent-notice'

export type TelegramSentMessage = { chatId: number; messageId: number }

export type TelegramOpenNotice = {
  kind: 'blocked' | 'waiting'
  text: string
  messages: TelegramSentMessage[]
}

export type TelegramNoticeDecision = {
  /** A blocked/waiting notice the pane has left; edit it to read as answered. */
  resolve?: TelegramOpenNotice
  notify?: TelegramNoticeKind
}

type PaneTrack = {
  state: AgentStatusEntry['state']
  stateStartedAt: number
  open?: TelegramOpenNotice
}

/** Status-store event -> the AgentStatusEntry shape notice formatting reads. */
export function telegramStatusEntryFromEnriched(
  enriched: Pick<
    EnrichedAgentHookEventPayload,
    | 'paneKey'
    | 'payload'
    | 'receivedAt'
    | 'stateStartedAt'
    | 'worktreeId'
    | 'tabId'
    | 'connectionId'
    | 'terminalHandle'
    | 'restoredUnconfirmed'
  >
): AgentStatusEntry {
  const { payload } = enriched
  const completedMessage =
    payload.state === 'done' && !payload.lastAssistantMessageIsToolOutput
      ? payload.lastAssistantMessage
      : undefined
  return {
    state: payload.state,
    prompt: payload.prompt,
    updatedAt: enriched.receivedAt,
    stateStartedAt: enriched.stateStartedAt,
    paneKey: enriched.paneKey,
    connectionId: enriched.connectionId,
    stateHistory: [],
    ...(payload.agentType !== undefined ? { agentType: payload.agentType } : {}),
    ...(enriched.worktreeId !== undefined ? { worktreeId: enriched.worktreeId } : {}),
    ...(enriched.tabId !== undefined ? { tabId: enriched.tabId } : {}),
    ...(enriched.terminalHandle !== undefined ? { terminalHandle: enriched.terminalHandle } : {}),
    ...(payload.toolName !== undefined ? { toolName: payload.toolName } : {}),
    ...(payload.toolInput !== undefined ? { toolInput: payload.toolInput } : {}),
    ...(payload.interactivePrompt !== undefined
      ? { interactivePrompt: payload.interactivePrompt }
      : {}),
    ...(payload.lastAssistantMessage !== undefined
      ? { lastAssistantMessage: payload.lastAssistantMessage }
      : {}),
    ...(payload.lastAssistantMessageIsToolOutput !== undefined
      ? { lastAssistantMessageIsToolOutput: payload.lastAssistantMessageIsToolOutput }
      : {}),
    ...(completedMessage ? { lastCompletedAssistantMessage: completedMessage } : {}),
    ...(payload.interrupted !== undefined ? { interrupted: payload.interrupted } : {}),
    ...(payload.sessionBoundary !== undefined ? { sessionBoundary: payload.sessionBoundary } : {}),
    ...(payload.mainAgent !== undefined ? { mainAgent: payload.mainAgent } : {}),
    ...(enriched.restoredUnconfirmed ? { restoredUnconfirmed: true } : {})
  }
}

export class TelegramNoticeTransitions {
  private readonly panes = new Map<string, PaneTrack>()
  private readonly recentNotices = new Map<string, number>()

  /**
   * `replay` marks evidence re-sent after a reconnect: it refreshes the baseline but
   * never notifies, so an SSH reconnect does not re-announce what was already seen.
   */
  observe(entry: AgentStatusEntry, now: number, replay = false): TelegramNoticeDecision {
    const previous = this.panes.get(entry.paneKey)
    const isNewState =
      !previous ||
      previous.state !== entry.state ||
      previous.stateStartedAt !== entry.stateStartedAt
    if (!isNewState) {
      return {}
    }
    const decision: TelegramNoticeDecision = {}
    if (previous?.open) {
      decision.resolve = previous.open
    }
    this.panes.set(entry.paneKey, { state: entry.state, stateStartedAt: entry.stateStartedAt })
    const kind = telegramNoticeKindFor(entry)
    // Why: a `done` with no observed prior turn (first sight of the pane) is a stale claim, not a completion.
    const doneWithoutTurn = kind === 'done' && (!previous || previous.state === 'done')
    if (
      kind &&
      !replay &&
      !doneWithoutTurn &&
      reserveNotificationCooldown(this.recentNotices, `${entry.paneKey}\u0000${kind}`, now)
    ) {
      decision.notify = kind
    }
    return decision
  }

  /** Records the notice the bridge sent so leaving the state can edit it. */
  recordSent(paneKey: string, stateStartedAt: number, notice: TelegramOpenNotice): void {
    const track = this.panes.get(paneKey)
    if (track && track.state === notice.kind && track.stateStartedAt === stateStartedAt) {
      track.open = notice
    }
  }

  forget(paneKey: string): void {
    this.panes.delete(paneKey)
  }

  clear(): void {
    this.panes.clear()
    this.recentNotices.clear()
  }
}
