import { describe, expect, it } from 'vitest'
import {
  AGENT_STATUS_STALE_AFTER_MS,
  type AgentStatusIpcPayload
} from '../../shared/agent-status-types'
import type { RuntimeMobileSessionTerminalTab } from '../../shared/runtime-types'
import type { RuntimeAgentRowSnapshot } from './runtime-hook-agent-row-selection'
import { buildRuntimeMobileAgentStatus } from './runtime-mobile-agent-status-builder'

const PROVIDER_SESSION = { key: 'session_id' as const, id: 'session-1' }
const TAB: RuntimeMobileSessionTerminalTab = {
  type: 'terminal',
  id: 'tab::leaf',
  parentTabId: 'tab',
  leafId: 'leaf',
  title: 'Terminal',
  isActive: true
}

describe('mobile agent status builder', () => {
  it('publishes a hook-only DeepSeek pane with deepseek resume identity, and never as claude', () => {
    const providerSession = { ...PROVIDER_SESSION, transcriptPath: '/h/.claude-deepseek/p/s.jsonl' }
    const row = (receivedAt: number): AgentStatusIpcPayload => ({
      paneKey: 'tab:leaf',
      connectionId: null,
      state: 'done',
      prompt: '',
      agentType: 'claude',
      displayAgentType: 'deepseek',
      providerSession,
      receivedAt,
      stateStartedAt: receivedAt
    })
    const host = { getPaneKey: () => 'tab:leaf', getLeaf: () => null, getTrackedTitle: () => null }
    const live = buildRuntimeMobileAgentStatus(null, TAB, null, null, () => [row(Date.now())], host)
    expect(live).toEqual({
      agentStatus: expect.objectContaining({ agentType: 'deepseek', providerSession })
    })
    // A stale row keeps its resume address but no agent, so no client can resume it as claude.
    const stale = buildRuntimeMobileAgentStatus(
      null,
      TAB,
      null,
      null,
      () => [row(Date.now() - AGENT_STATUS_STALE_AFTER_MS - 1)],
      host
    )
    expect(stale).toEqual({ agentStatus: expect.objectContaining({ providerSession }) })
    expect(stale).not.toHaveProperty('agentStatus.agentType')
  })

  it('shows a host-stamped DeepSeek row as deepseek, like a desktop host renderer does', () => {
    const retained: RuntimeAgentRowSnapshot = {
      paneKey: 'tab:leaf',
      connectionId: null,
      payload: {
        state: 'working',
        prompt: 'ship it',
        agentType: 'claude',
        displayAgentType: 'deepseek'
      },
      stateStartedAt: 10,
      updatedAt: 10
    }

    const result = buildRuntimeMobileAgentStatus(null, TAB, 'term-1', retained, () => [], {
      getPaneKey: () => 'tab:leaf',
      getLeaf: () => null,
      getTrackedTitle: () => null
    })

    expect(result).toEqual({ agentStatus: expect.objectContaining({ agentType: 'deepseek' }) })
  })


  it('keeps provider-session identity from a terminal-handle row rejoin', () => {
    const retained: RuntimeAgentRowSnapshot = {
      paneKey: 'old-tab:old-leaf',
      connectionId: null,
      payload: { state: 'working', prompt: 'ship it', agentType: 'codex' },
      stateStartedAt: 10,
      updatedAt: 10,
      providerSession: PROVIDER_SESSION
    }

    const result = buildRuntimeMobileAgentStatus(null, TAB, 'term-1', retained, () => [], {
      getPaneKey: () => 'new-tab:new-leaf',
      getLeaf: () => null,
      getTrackedTitle: () => null
    })

    expect(result).toEqual(
      expect.objectContaining({
        agentStatus: expect.objectContaining({ providerSession: PROVIDER_SESSION })
      })
    )
  })
})
