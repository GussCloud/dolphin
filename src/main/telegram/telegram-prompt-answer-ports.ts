import { randomUUID } from 'node:crypto'
import type { AgentQuestionAnsweredInferenceRequest } from '../../shared/agent-question-answered-intent'
import { computeAgentSessionPayloadFingerprint } from '../../shared/agent-session-mutation-envelope'
import { pickParsedAgentStatusPayload } from '../../shared/agent-status-types'
import type { AgentStatusIpcPayload } from '../../shared/agent-status-ipc-payload'
import type { StructuredAgentSessionHost } from '../native-chat/agent-session-wire/structured-agent-session-host'
import type { RpcRequest, RpcResponse } from '../runtime/rpc/core'
import type { TelegramStructuredPromptSnapshot } from './telegram-answerable-prompt'
import { telegramStatusEntryFromEnriched } from './telegram-notice-transitions'
import type {
  TelegramDeliveryOutcome,
  TelegramTerminalOutcome
} from './telegram-prompt-answer-delivery'
import type { TelegramPromptAnswerPorts } from './telegram-prompt-answer-service'

export type TelegramPromptAnswerPortDeps = {
  statusSource: {
    getStatusSnapshotForPane(paneKey: string): AgentStatusIpcPayload[]
    inferQuestionAnswered(request: AgentQuestionAnsweredInferenceRequest): boolean
  }
  /** In-process runtime RPC, so terminal.send keeps its SSH/WSL routing and input locks. */
  dispatchRpc: (request: RpcRequest) => Promise<RpcResponse>
  getStructuredHost: () => StructuredAgentSessionHost | null
  resolveWorktreeQuery: (query: string) => { worktreeId: string; paneKeys: string[] }[]
}

const TELEGRAM_STRUCTURED_CALLER = { callerKey: 'trusted-local:telegram' }

type HostMutationResult = { ok: true } | { ok: false; refusal: { code: string } }

function hostOutcome(result: HostMutationResult): TelegramDeliveryOutcome {
  if (result.ok) {
    return 'accepted'
  }
  return result.refusal.code === 'agent_session_operation_unknown' ? 'unknown' : 'rejected'
}

function envelope(
  sessionId: string,
  fence: number,
  method: string,
  fields: Record<string, unknown>
) {
  return {
    sessionId,
    clientOperationId: randomUUID(),
    expectedRuntimeFence: fence,
    payloadFingerprint: computeAgentSessionPayloadFingerprint({ method, sessionId, fields })
  }
}

function terminalSendOutcome(result: unknown): TelegramTerminalOutcome {
  const send =
    typeof result === 'object' && result !== null && 'send' in result ? result.send : null
  if (typeof send !== 'object' || send === null) {
    return 'rejected'
  }
  if ('accepted' in send && send.accepted === true) {
    return 'accepted'
  }
  const reason = 'refusedReason' in send ? send.refusedReason : undefined
  return reason === 'no-agent' || reason === 'permission' ? reason : 'rejected'
}

/** Binds the answer service to the status store, runtime RPC and structured host. */
export function createTelegramPromptAnswerPorts(
  deps: TelegramPromptAnswerPortDeps
): TelegramPromptAnswerPorts {
  async function runHostMutation(
    run: (host: StructuredAgentSessionHost) => Promise<HostMutationResult>
  ): Promise<TelegramDeliveryOutcome> {
    const host = deps.getStructuredHost()
    if (!host) {
      return 'rejected'
    }
    try {
      return hostOutcome(await run(host))
    } catch {
      // The host may have admitted the mutation before throwing.
      return 'unknown'
    }
  }

  return {
    readEntry: (paneKey) => {
      const row = deps.statusSource.getStatusSnapshotForPane(paneKey)[0]
      return row
        ? telegramStatusEntryFromEnriched({
            ...row,
            restoredUnconfirmed: row.restoredUnconfirmed === true ? true : undefined,
            payload: pickParsedAgentStatusPayload(row)
          })
        : null
    },
    readStructuredPrompt: (sessionId): TelegramStructuredPromptSnapshot | null => {
      const host = deps.getStructuredHost()
      const fence = host?.sessionFence(sessionId) ?? null
      if (!host || fence === null) {
        return null
      }
      try {
        return { fence, items: host.journalSnapshot(sessionId).items }
      } catch {
        return null
      }
    },
    sendTerminal: async ({ terminal, text, enter, requireAgentStatus }) => {
      let response: RpcResponse
      try {
        // No client: Telegram has no viewport, so it must not take the mobile input floor.
        response = await deps.dispatchRpc({
          id: `telegram-${randomUUID()}`,
          authToken: 'telegram-bridge',
          method: 'terminal.send',
          params: {
            terminal,
            ...(text !== undefined ? { text } : {}),
            enter,
            ...(requireAgentStatus ? { requireAgentStatus } : {})
          }
        })
      } catch {
        return 'unknown'
      }
      return response.ok ? terminalSendOutcome(response.result) : 'rejected'
    },
    respondStructured: (response) =>
      runHostMutation((host) => {
        const fields = {
          itemId: response.itemId,
          expectedRevision: response.expectedRevision,
          optionId: response.optionId,
          answers: response.answers
        }
        return host.respondToPrompt(TELEGRAM_STRUCTURED_CALLER, {
          ...fields,
          kind: response.kind,
          envelope: envelope(
            response.sessionId,
            response.fence,
            `agentSession.respondTo:${response.kind}`,
            fields
          )
        })
      }),
    sendStructuredMessage: ({ sessionId, fence, text }) =>
      runHostMutation((host) => {
        const body = {
          kind: 'message' as const,
          role: 'user' as const,
          blocks: [{ type: 'text' as const, text }]
        }
        return host.send(TELEGRAM_STRUCTURED_CALLER, {
          envelope: envelope(sessionId, fence, 'agentSession.send', { body }),
          body
        })
      }),
    inferQuestionAnswered: (request) => {
      deps.statusSource.inferQuestionAnswered(request)
    },
    resolveWorktreeQuery: deps.resolveWorktreeQuery
  }
}
