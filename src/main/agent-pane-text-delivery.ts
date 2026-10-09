// Typing free text into an agent TUI through runtime `terminal.send`, shared by every in-process
// sender (Telegram answers, connection-loss auto-retry) so SSH/WSL routing and guards stay identical.
import { randomUUID } from 'node:crypto'
import {
  buildAgentPromptPasteBytes,
  getAgentPromptSubmitDelayMs
} from '../shared/agent-prompt-injection'
import type { RpcRequest, RpcResponse } from './runtime/rpc/core'

/** `unknown` = the write may have landed (ack lost); never report it as a definite failure. */
export type AgentPaneDeliveryOutcome = 'accepted' | 'rejected' | 'unknown'
/** terminal.send's `requireAgentStatus: 'sendable'` refusals, before any byte is written. */
export type AgentPaneTerminalOutcome = AgentPaneDeliveryOutcome | 'no-agent' | 'permission'

export type AgentPaneTerminalSend = (input: {
  terminal: string
  text?: string
  enter: boolean
  requireAgentStatus?: 'sendable'
}) => Promise<AgentPaneTerminalOutcome>

export type AgentPaneTextTransport = {
  /** Must go through the runtime `terminal.send` path so SSH/WSL panes and input locks behave as for mobile. */
  sendTerminal: AgentPaneTerminalSend
  wait: (ms: number) => Promise<void>
}

/** A refusal of the paste, or `partly-sent` when the paste landed but its Enter did not. */
export type AgentPaneTextResult = AgentPaneTerminalOutcome | 'partly-sent'

/** Paste then Enter, both guarded so a dead agent's shell never runs the text. */
export async function deliverAgentPanePlainText(
  transport: AgentPaneTextTransport,
  terminal: string,
  text: string
): Promise<AgentPaneTextResult> {
  const paste = buildAgentPromptPasteBytes(text)
  const pasted = await transport.sendTerminal({
    terminal,
    text: paste,
    enter: false,
    requireAgentStatus: 'sendable'
  })
  if (pasted !== 'accepted') {
    return pasted
  }
  await transport.wait(
    getAgentPromptSubmitDelayMs(process.platform, Buffer.byteLength(paste, 'utf8'))
  )
  const submitted = await transport.sendTerminal({
    terminal,
    enter: true,
    requireAgentStatus: 'sendable'
  })
  return submitted === 'accepted' ? 'accepted' : 'partly-sent'
}

function terminalSendOutcome(result: unknown): AgentPaneTerminalOutcome {
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

/** `terminal.send` over in-process runtime RPC with no client: the sender has no viewport, so it
 *  must not take the mobile input floor. */
export function createRpcAgentPaneTerminalSend(
  dispatchRpc: (request: RpcRequest) => Promise<RpcResponse>,
  caller: string
): AgentPaneTerminalSend {
  return async ({ terminal, text, enter, requireAgentStatus }) => {
    let response: RpcResponse
    try {
      response = await dispatchRpc({
        id: `${caller}-${randomUUID()}`,
        authToken: caller,
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
  }
}
