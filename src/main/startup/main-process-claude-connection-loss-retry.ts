import { agentHookServer } from '../agent-hooks/server'
import {
  createRpcAgentPaneTerminalSend,
  deliverAgentPanePlainText
} from '../agent-pane-text-delivery'
import {
  createAutoRetryDoneNoticeFilter,
  startClaudeConnectionLossRetry,
  type ClaudeConnectionLossExhaustedEvent
} from '../agent-turn-recovery/claude-connection-loss-retry'
import { translateMain } from '../i18n/main-i18n'
import { dispatchMainProcessNotification } from '../ipc/notifications'
import { lastInputAtByPty } from '../ipc/pty/delivery/visibility-state'
import type { Store } from '../persistence'
import type { DolphinRuntimeService } from '../runtime/dolphin-runtime'
import { RpcDispatcher } from '../runtime/rpc/dispatcher'
import type { TelegramBridgeService } from '../telegram/telegram-bridge-service'
import { resolveTelegramWorktreeName } from './main-process-telegram'

export function claudeConnectionLossExhaustedTelegramText(
  worktreeName: string | null,
  attempts: number
): string {
  const where = worktreeName ? ` (${worktreeName})` : ''
  return `⚠️ ${translateMain(
    'notifications.autoRetryExhausted.telegram',
    'Claude lost its API connection{{where}} and {{attempts}} automatic retries did not recover it. Reply "continue" to resume.',
    { where, attempts }
  )}`
}

/** Starts connection-loss auto-retry beside the Telegram bridge, which it also notifies. */
export function startMainProcessClaudeConnectionLossRetry(
  store: Store,
  runtime: DolphinRuntimeService,
  bridge: TelegramBridgeService | null
): () => void {
  const isEnabled = (): boolean => store.getSettings().claudeAutoRetryOnConnectionLoss !== false
  const dispatcher = new RpcDispatcher({ runtime })
  const transport = {
    sendTerminal: createRpcAgentPaneTerminalSend(
      (request) => dispatcher.dispatch(request),
      'agent-auto-retry'
    ),
    wait: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
  }

  const notifyExhausted = ({
    paneKey,
    worktreeId,
    attempts
  }: ClaudeConnectionLossExhaustedEvent) => {
    const worktreeLabel = worktreeId ? resolveTelegramWorktreeName(store, worktreeId) : null
    void Promise.resolve(
      dispatchMainProcessNotification({
        source: 'agent-auto-retry-exhausted',
        paneKey,
        ...(worktreeId ? { worktreeId } : {}),
        ...(worktreeLabel ? { worktreeLabel } : {}),
        agentType: 'claude',
        agentState: 'done'
      })
    ).catch((error: unknown) => console.warn('[agent-auto-retry] notification failed', error))
    if (bridge) {
      void bridge
        .sendToAllowedChats(claudeConnectionLossExhaustedTelegramText(worktreeLabel, attempts), {
          replyToRoute: bridge.createRoute(paneKey)
        })
        .catch((error: unknown) => console.warn('[agent-auto-retry] telegram notice failed', error))
    }
  }

  const disposeFilter = bridge?.registerNoticeFilter(createAutoRetryDoneNoticeFilter(isEnabled))
  const disposeRetry = startClaudeConnectionLossRetry({
    subscribeEnrichedStatus: (listener) => agentHookServer.subscribeEnrichedStatus(listener),
    subscribeStatusDrop: (listener) => agentHookServer.subscribeStatusDrop(listener),
    subscribePaneStatusClear: (listener) => agentHookServer.subscribePaneStatusClear(listener),
    isEnabled,
    resolveTerminalHandle: (paneKey, reported) =>
      runtime.getLiveTerminalHandleForPaneKey(paneKey) ?? reported ?? null,
    readLastInputAt: (terminal) => {
      const ptyId = runtime.resolveLiveLeafForHandle(terminal)?.ptyId
      return ptyId ? lastInputAtByPty.get(ptyId) : undefined
    },
    sendText: (terminal, text) => deliverAgentPanePlainText(transport, terminal, text),
    notifyExhausted
  })
  return () => {
    disposeRetry()
    disposeFilter?.()
  }
}
