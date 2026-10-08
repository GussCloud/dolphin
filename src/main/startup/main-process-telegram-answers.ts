import { agentHookServer } from '../agent-hooks/server'
import { getStructuredAgentSessionHost } from '../native-chat/agent-session-wire/structured-agent-session-registry'
import type { DolphinRuntimeService } from '../runtime/dolphin-runtime'
import { RpcDispatcher } from '../runtime/rpc/dispatcher'
import type { TelegramBridgeService } from '../telegram/telegram-bridge-service'
import { createTelegramPromptAnswerPorts } from '../telegram/telegram-prompt-answer-ports'
import { createTelegramPromptAnswerService } from '../telegram/telegram-prompt-answer-service'
import { createTelegramPromptButtonDecorator } from '../telegram/telegram-prompt-buttons'
import type { TelegramInboundHandler } from '../telegram/telegram-inbound'

/** Adds answer buttons to notices and answers taps/replies; `wrapInboundHandler` lets the Claude channel answer first. */
export function startMainProcessTelegramAnswers(
  bridge: TelegramBridgeService,
  runtime: DolphinRuntimeService,
  wrapInboundHandler: (handler: TelegramInboundHandler) => TelegramInboundHandler = (handler) =>
    handler
): () => void {
  const dispatcher = new RpcDispatcher({ runtime })
  const ports = createTelegramPromptAnswerPorts({
    statusSource: agentHookServer,
    dispatchRpc: (request) => dispatcher.dispatch(request),
    getStructuredHost: getStructuredAgentSessionHost,
    resolveWorktreeQuery: (query) => bridge.resolveWorktreeQuery(query),
    resolveTerminalHandle: (paneKey) => runtime.getLiveTerminalHandleForPaneKey(paneKey)
  })
  const disposeDecorator = bridge.registerNoticeDecorator(
    createTelegramPromptButtonDecorator(ports.readStructuredPrompt)
  )
  const disposeHandler = bridge.registerInboundHandler(
    wrapInboundHandler(createTelegramPromptAnswerService(ports))
  )
  return () => {
    disposeHandler()
    disposeDecorator()
  }
}
