import { describe, expect, it } from 'vitest'
import type { AgentStatusIpcPayload } from '../../shared/agent-status-types'
import { selectRuntimeHookAgentRowForPane } from './runtime-mobile-agent-status-projection'

const PROVIDER_SESSION = {
  key: 'session_id' as const,
  id: 'session-1',
  transcriptPath: '/home/me/.claude-deepseek/projects/repo/session-1.jsonl'
}

function hookRow(over: Partial<AgentStatusIpcPayload> = {}): AgentStatusIpcPayload {
  return {
    paneKey: 'tab:55555555-5555-4555-8555-555555555555',
    connectionId: null,
    state: 'done',
    prompt: '',
    agentType: 'claude',
    providerSession: PROVIDER_SESSION,
    receivedAt: Date.now(),
    stateStartedAt: Date.now(),
    ...over
  }
}

describe('selectRuntimeHookAgentRowForPane resume identity', () => {
  it('publishes a host-stamped DeepSeek session as deepseek, never as claude', () => {
    const lookup = selectRuntimeHookAgentRowForPane([hookRow({ displayAgentType: 'deepseek' })])
    expect(lookup.providerSession).toEqual(PROVIDER_SESSION)
    expect(lookup.providerSessionAgentType).toBe('deepseek')
    expect(lookup.agentType).toBe('deepseek')
  })

  it('keeps an unstamped Claude session as claude', () => {
    const lookup = selectRuntimeHookAgentRowForPane([hookRow()])
    expect(lookup.providerSessionAgentType).toBe('claude')
    expect(lookup.agentType).toBe('claude')
  })
})
