import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentStatusEntry } from '../../../../../shared/agent-status-types'
import { bindBuildColdRestoreAgentResumeStartup } from './cold-restore-resume-startup'
import type { ConnectPanePtySession } from './connect-pane-pty-session'

const PANE_KEY = 'tab-1:11111111-1111-4111-8111-111111111111'

const state = vi.hoisted(() => {
  const agentStatusByPaneKey: Record<string, unknown> = {}
  return { agentStatusByPaneKey, settings: {}, getAgentLaunchConfigForStatusEntry: () => undefined }
})

vi.mock('@/store', () => ({ useAppStore: { getState: () => state } }))

function entry(overrides: Partial<AgentStatusEntry> = {}): AgentStatusEntry {
  return {
    state: 'working',
    prompt: 'build it',
    updatedAt: 1,
    stateStartedAt: 1,
    paneKey: PANE_KEY,
    agentType: 'claude',
    providerSession: { key: 'session_id', id: 'teammate-session' },
    stateHistory: [],
    ...overrides
  }
}

function boundSession(): ConnectPanePtySession {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: a deliberately partial session bag; the not-resumable guard returns before any other member is read.
  const session = {
    cacheKey: PANE_KEY,
    pendingStartupCommand: null,
    getSleepingRecordForPane: () => null
  } as unknown as ConnectPanePtySession
  bindBuildColdRestoreAgentResumeStartup(session)
  return session
}

describe('cold-restore agent resume startup', () => {
  beforeEach(() => {
    state.agentStatusByPaneKey = {}
  })

  it('resumes an ordinary working agent pane', () => {
    state.agentStatusByPaneKey[PANE_KEY] = entry()

    expect(boundSession().buildColdRestoreAgentResumeStartup()).toMatchObject({
      agent: 'claude',
      resumeProviderSession: { id: 'teammate-session' }
    })
  })

  it('never resumes an Agent Teams teammate the host marked not resumable', () => {
    state.agentStatusByPaneKey[PANE_KEY] = entry({ terminalResumeEligible: false })

    expect(boundSession().buildColdRestoreAgentResumeStartup()).toBeNull()
  })
})
