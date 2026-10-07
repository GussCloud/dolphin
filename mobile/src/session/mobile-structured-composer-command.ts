import type { AgentSessionConversationCommandResult } from '../../../src/shared/agent-session-conversation-command'
import {
  dispatchStructuredAgentSessionComposerCommand,
  isStructuredAgentSessionComposerCommand,
  type StructuredAgentSessionComposerOptions
} from '../../../src/shared/structured-agent-session-composer'
import type { RpcClient } from '../transport/rpc-client'
import type { MobileNativeChatSendOutcome } from './mobile-native-chat-send'
import {
  requestStructuredAgentSessionMutation,
  retainStructuredSessionOperationId
} from './mobile-structured-agent-session-rpc'
import { sessionChatCatalog } from '../i18n/catalogs/session-chat'
import { translate } from '../i18n/mobile-locale-state'

export async function dispatchMobileStructuredCommand(input: {
  text: string
  hasAttachments: boolean
  client: RpcClient
  sessionId: string
  fence: number
  sessionKey: string
  pending: { current: boolean }
  operationIds: Map<string, string>
  controller: StructuredAgentSessionComposerOptions
  canRun: () => boolean
  onError: (message: string) => void
  timeoutMs: number
}): Promise<MobileNativeChatSendOutcome | null> {
  if (input.pending.current) {
    return 'rejected'
  }
  if (!isStructuredAgentSessionComposerCommand(input.text, input.controller.agent)) {
    return null
  }
  if (input.hasAttachments) {
    input.onError(translate(sessionChatCatalog, 'commandRemoveAttachments'))
    return 'rejected'
  }
  let unknown = false
  const outcome = await dispatchStructuredAgentSessionComposerCommand(input.text, {
    ...input.controller,
    runConversationCommand: async (command) => {
      if (!input.canRun()) {
        return {
          accepted: false,
          error: translate(sessionChatCatalog, 'commandWaitForPendingWork')
        }
      }
      input.pending.current = true
      const key = `${input.sessionKey}:agentSession.conversationCommand:${command}`
      const clientOperationId = retainStructuredSessionOperationId(
        input.operationIds,
        key,
        input.operationIds.get(key)
      )
      try {
        const result =
          await requestStructuredAgentSessionMutation<AgentSessionConversationCommandResult>({
            client: input.client,
            sessionId: input.sessionId,
            expectedRuntimeFence: input.fence,
            method: 'agentSession.conversationCommand',
            fingerprintMethod: 'agentSession.conversationCommand',
            fields: { command },
            clientOperationId,
            timeoutMs: Math.max(input.timeoutMs, 195_000)
          })
        if (
          result.status === 'unknown' ||
          (result.status === 'accepted' && result.value.state === 'unknown')
        ) {
          unknown = true
          return {
            accepted: false,
            error: translate(sessionChatCatalog, 'commandOperationUnconfirmed')
          }
        }
        input.operationIds.delete(key)
        return result.status === 'accepted'
          ? { accepted: !result.value.error, error: result.value.error ?? null }
          : { accepted: false, error: result.message }
      } finally {
        input.pending.current = false
      }
    }
  })
  if (outcome.error) {
    input.onError(outcome.error)
  }
  return unknown ? 'unknown' : outcome.accepted ? 'accepted' : 'rejected'
}
