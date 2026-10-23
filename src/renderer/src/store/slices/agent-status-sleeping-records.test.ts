import { describe, expect, it } from 'vitest'
import type { AgentStatusEntry } from '../../../../shared/agent-status-types'
import type { TerminalTab } from '../../../../shared/terminal-tab-types'
import type { AppState } from '../types'
import { sleepingRecordFromEntry } from './agent-status-sleeping-records'

const PROVIDER_SESSION = {
  key: 'session_id' as const,
  id: 'session-1',
  transcriptPath: '/home/me/.claude-deepseek/projects/repo/session-1.jsonl'
}

function record(agentType: AgentStatusEntry['agentType']) {
  const entry: AgentStatusEntry = {
    paneKey: 'tab-1:55555555-5555-4555-8555-555555555555',
    state: 'done',
    prompt: '',
    agentType,
    providerSession: PROVIDER_SESSION,
    updatedAt: 1,
    stateStartedAt: 1,
    stateHistory: []
  }
  return sleepingRecordFromEntry({
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: state is read only to find the tab, and the tab is passed explicitly.
    state: {} as AppState,
    entry,
    worktreeId: 'wt-1',
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: only `id` is read from the tab.
    tab: { id: 'tab-1' } as TerminalTab,
    capturedAt: 2
  })
}

describe('sleepingRecordFromEntry for a DeepSeek status row', () => {
  // The applicator re-labels a host-stamped row `deepseek`; the record must resume under DeepSeek.
  it('records the deepseek agent so the resume relaunches with the DeepSeek env', () => {
    expect(record('deepseek')).toMatchObject({ agent: 'deepseek', providerSession: PROVIDER_SESSION })
  })
})
