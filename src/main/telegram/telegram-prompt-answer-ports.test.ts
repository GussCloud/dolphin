import { describe, expect, it, vi } from 'vitest'
import { computeAgentSessionPayloadFingerprint } from '../../shared/agent-session-mutation-envelope'
import type { AgentStatusIpcPayload } from '../../shared/agent-status-ipc-payload'
import type { StructuredAgentSessionHost } from '../native-chat/agent-session-wire/structured-agent-session-host'
import type { RpcRequest, RpcResponse } from '../runtime/rpc/core'
import {
  createTelegramPromptAnswerPorts,
  type TelegramPromptAnswerPortDeps
} from './telegram-prompt-answer-ports'

const row: AgentStatusIpcPayload = {
  paneKey: 'tab:leaf',
  state: 'waiting',
  prompt: 'go',
  agentType: 'claude',
  interactivePrompt: '{"questions":[]}',
  terminalHandle: 'term-1',
  connectionId: 'ssh-1',
  receivedAt: 42,
  stateStartedAt: 40
}

function success(result: unknown): RpcResponse {
  return { id: 'x', ok: true, result, _meta: { runtimeId: 'r' } }
}

type HostStub = Pick<
  StructuredAgentSessionHost,
  'sessionFence' | 'journalSnapshot' | 'respondToPrompt' | 'send'
>

function setup(
  overrides: { host?: Partial<HostStub> | null; dispatch?: RpcResponse | Error } = {}
) {
  const requests: RpcRequest[] = []
  const hostStub = overrides.host === null ? null : { ...overrides.host }
  const deps: TelegramPromptAnswerPortDeps = {
    statusSource: {
      getStatusSnapshotForPane: (paneKey) => (paneKey === row.paneKey ? [row] : []),
      inferQuestionAnswered: vi.fn(() => true)
    },
    dispatchRpc: async (request) => {
      requests.push(request)
      if (overrides.dispatch instanceof Error) {
        throw overrides.dispatch
      }
      return overrides.dispatch ?? success({ send: { accepted: true } })
    },
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the ports only call the four HostStub methods.
    getStructuredHost: () => hostStub as unknown as StructuredAgentSessionHost,
    resolveWorktreeQuery: () => []
  }
  return { ports: createTelegramPromptAnswerPorts(deps), requests, deps }
}

describe('createTelegramPromptAnswerPorts', () => {
  it('reads the live status row as an entry, keeping the SSH connection and terminal', () => {
    const { ports } = setup()
    expect(ports.readEntry('tab:leaf')).toMatchObject({
      paneKey: 'tab:leaf',
      state: 'waiting',
      updatedAt: 42,
      terminalHandle: 'term-1',
      connectionId: 'ssh-1',
      interactivePrompt: '{"questions":[]}'
    })
    expect(ports.readEntry('missing')).toBeNull()
  })

  it('sends terminal input through runtime terminal.send without a client', async () => {
    const { ports, requests } = setup()
    expect(await ports.sendTerminal({ terminal: 'term-1', text: '1', enter: false })).toBe(
      'accepted'
    )
    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({
      method: 'terminal.send',
      params: { terminal: 'term-1', text: '1', enter: false }
    })
    expect(requests[0]!.params).not.toHaveProperty('client')
  })

  it('forwards the agent-status guard and maps its refusal reasons', async () => {
    const noAgent = setup({
      dispatch: success({ send: { accepted: false, refusedReason: 'no-agent' } })
    })
    expect(
      await noAgent.ports.sendTerminal({
        terminal: 't',
        text: 'x',
        enter: false,
        requireAgentStatus: 'sendable'
      })
    ).toBe('no-agent')
    expect(noAgent.requests[0]!.params).toEqual({
      terminal: 't',
      text: 'x',
      enter: false,
      requireAgentStatus: 'sendable'
    })
    const permission = setup({
      dispatch: success({ send: { accepted: false, refusedReason: 'permission' } })
    })
    expect(await permission.ports.sendTerminal({ terminal: 't', enter: true })).toBe('permission')
    expect(permission.requests[0]!.params).toEqual({ terminal: 't', enter: true })
  })

  it('maps a refused send to rejected and a transport throw to unknown', async () => {
    const refused = setup({ dispatch: success({ send: { accepted: false } }) })
    expect(await refused.ports.sendTerminal({ terminal: 't', text: 'x', enter: true })).toBe(
      'rejected'
    )
    const failed = setup({
      dispatch: {
        id: 'x',
        ok: false,
        error: { code: 'terminal_handle_stale', message: '' },
        _meta: { runtimeId: 'r' }
      }
    })
    expect(await failed.ports.sendTerminal({ terminal: 't', text: 'x', enter: true })).toBe(
      'rejected'
    )
    const thrown = setup({ dispatch: new Error('socket closed') })
    expect(await thrown.ports.sendTerminal({ terminal: 't', text: 'x', enter: true })).toBe(
      'unknown'
    )
  })

  it('reads a structured snapshot only when the session is loaded', () => {
    const items = [{ itemId: 'i' }]
    const { ports } = setup({
      host: {
        sessionFence: (id) => (id === 's1' ? 3 : null),
        // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: only `items` is read.
        journalSnapshot: () => ({ items }) as unknown as ReturnType<HostStub['journalSnapshot']>
      }
    })
    expect(ports.readStructuredPrompt('s1')).toEqual({ fence: 3, items })
    expect(ports.readStructuredPrompt('s2')).toBeNull()
    expect(setup({ host: null }).ports.readStructuredPrompt('s1')).toBeNull()
  })

  it('fingerprints prompt replies exactly as the host digests them', async () => {
    const respondToPrompt = vi.fn(async () => ({ ok: true }))
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the port reads only `ok`/`refusal`.
    const { ports } = setup({ host: { respondToPrompt } as unknown as Partial<HostStub> })
    expect(
      await ports.respondStructured({
        sessionId: 's1',
        fence: 3,
        kind: 'approval',
        itemId: 'item',
        expectedRevision: 2,
        optionId: 'yes'
      })
    ).toBe('accepted')
    expect(respondToPrompt).toHaveBeenCalledWith(
      { callerKey: 'trusted-local:telegram' },
      expect.objectContaining({
        kind: 'approval',
        itemId: 'item',
        expectedRevision: 2,
        optionId: 'yes',
        envelope: expect.objectContaining({
          sessionId: 's1',
          expectedRuntimeFence: 3,
          payloadFingerprint: computeAgentSessionPayloadFingerprint({
            method: 'agentSession.respondTo:approval',
            sessionId: 's1',
            fields: { itemId: 'item', expectedRevision: 2, optionId: 'yes' }
          })
        })
      })
    )
  })

  it('sends a structured text message and maps host refusals', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, refusal: { code: 'agent_session_operation_unknown' } })
      .mockResolvedValueOnce({ ok: false, refusal: { code: 'agent_session_fence_mismatch' } })
      .mockRejectedValueOnce(new Error('boom'))
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the port reads only `ok`/`refusal`.
    const { ports } = setup({ host: { send } as unknown as Partial<HostStub> })
    const input = { sessionId: 's1', fence: 3, text: 'hi\nthere' }
    expect(await ports.sendStructuredMessage(input)).toBe('accepted')
    expect(await ports.sendStructuredMessage(input)).toBe('unknown')
    expect(await ports.sendStructuredMessage(input)).toBe('rejected')
    expect(await ports.sendStructuredMessage(input)).toBe('unknown')
    const body = { kind: 'message', role: 'user', blocks: [{ type: 'text', text: 'hi\nthere' }] }
    expect(send.mock.calls[0]![1]).toMatchObject({
      body,
      envelope: {
        expectedRuntimeFence: 3,
        payloadFingerprint: computeAgentSessionPayloadFingerprint({
          method: 'agentSession.send',
          sessionId: 's1',
          fields: { body }
        })
      }
    })
    expect(await setup({ host: null }).ports.sendStructuredMessage(input)).toBe('rejected')
  })

  it('forwards question-answered inference to the status store', () => {
    const { ports, deps } = setup()
    const request = {
      paneKey: 'tab:leaf',
      baselineUpdatedAt: 42,
      baselineStateStartedAt: 40,
      baselinePrompt: 'go',
      baselineAgentType: 'claude' as const
    }
    ports.inferQuestionAnswered?.(request)
    expect(deps.statusSource.inferQuestionAnswered).toHaveBeenCalledWith(request)
  })
})
