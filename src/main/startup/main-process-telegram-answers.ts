import { agentHookServer } from '../agent-hooks/server'
import { getStructuredAgentSessionHost } from '../native-chat/agent-session-wire/structured-agent-session-registry'
import type { DolphinRuntimeService } from '../runtime/dolphin-runtime'
import { RpcDispatcher } from '../runtime/rpc/dispatcher'
import type { TelegramBridgeService } from '../telegram/telegram-bridge-service'
import { createTelegramPromptAnswerPorts } from '../telegram/telegram-prompt-answer-ports'
import { createTelegramPromptAnswerService } from '../telegram/telegram-prompt-answer-service'
import { createTelegramPromptButtonDecorator } from '../telegram/telegram-prompt-buttons'

/** Adds answer buttons to notices and answers taps/replies; PR3's channel registers after this. */
export function startMainProcessTelegramAnswers(
  bridge: TelegramBridgeService,
  runtime: DolphinRuntimeService
): () => void {
  const dispatcher = new RpcDispatcher({ runtime })
  const ports = createTelegramPromptAnswerPorts({
    statusSource: agentHookServer,
    dispatchRpc: (request) => dispatcher.dispatch(request),
    getStructuredHost: getStructuredAgentSessionHost,
    resolveWorktreeQuery: (query) => bridge.resolveWorktreeQuery(query)
  })
  const disposeDecorator = bridge.registerNoticeDecorator(
    createTelegramPromptButtonDecorator(ports.readStructuredPrompt)
  )
  const disposeHandler = bridge.registerInboundHandler(createTelegramPromptAnswerService(ports))
  return () => {
    disposeHandler()
    disposeDecorator()
  }
}
