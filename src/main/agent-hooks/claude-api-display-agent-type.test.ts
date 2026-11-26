import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { registerClaudeProfileRootSources } from '../claude-accounts/profile/claude-profile-roots'
import { AgentHookServer } from './server'

const PANE_KEY = 'tab-api:66666666-6666-4666-8666-666666666666'
const ACCOUNTS_ROOT = join('/', 'user-data', 'claude-accounts')
const API_TRANSCRIPT = join(ACCOUNTS_ROOT, 'api-1', 'config', 'projects', 'repo', 'session-1.jsonl')
const PLAN_TRANSCRIPT = join(
  ACCOUNTS_ROOT,
  'plan-1',
  'config',
  'projects',
  'repo',
  'session-1.jsonl'
)

function hook(
  server: AgentHookServer,
  transcriptPath: string | undefined,
  payload: Record<string, unknown> = {}
): void {
  server.ingestRemote(
    {
      paneKey: PANE_KEY,
      tabId: 'tab-api',
      worktreeId: 'worktree',
      ...(transcriptPath
        ? { providerSession: { key: 'session_id', id: 'session-1', transcriptPath } }
        : {}),
      payload: { state: 'working', prompt: 'ship it', agentType: 'claude', ...payload }
    },
    null
  )
}

function osc(server: AgentHookServer, payload: Record<string, unknown> = {}): void {
  server.ingestTerminalStatus({
    paneKey: PANE_KEY,
    tabId: 'tab-api',
    worktreeId: 'worktree',
    connectionId: null,
    payload: { state: 'done', prompt: 'ship it', agentType: 'claude', ...payload }
  })
}

describe('the API-key presentation identity the hook host stamps', () => {
  beforeEach(() => {
    registerClaudeProfileRootSources({
      managedAccountsRoot: () => ACCOUNTS_ROOT,
      linkedConfigDirs: () => [],
      apiKeyAccountIds: () => ['api-1']
    })
  })

  afterEach(() => {
    registerClaudeProfileRootSources({
      managedAccountsRoot: () => null,
      linkedConfigDirs: () => [],
      apiKeyAccountIds: () => []
    })
  })

  it('keeps the harness agentType and stamps claude-api for a transcript in an API profile', () => {
    const server = new AgentHookServer()
    hook(server, API_TRANSCRIPT)
    expect(server.getStatusSnapshot()[0]).toMatchObject({
      agentType: 'claude',
      displayAgentType: 'claude-api'
    })
    osc(server)
    expect(server.getStatusSnapshot()[0]).toMatchObject({
      state: 'done',
      displayAgentType: 'claude-api'
    })
  })

  it('never stamps a plan profile row, even when the event claims claude-api', () => {
    const server = new AgentHookServer()
    hook(server, PLAN_TRANSCRIPT, { displayAgentType: 'claude-api' })
    expect(server.getStatusSnapshot()[0]).not.toHaveProperty('displayAgentType')
    osc(server, { displayAgentType: 'claude-api' })
    expect(server.getStatusSnapshot()[0]).not.toHaveProperty('displayAgentType')
  })

  it('stops stamping once the account is no longer an API account on this host', () => {
    registerClaudeProfileRootSources({
      managedAccountsRoot: () => ACCOUNTS_ROOT,
      linkedConfigDirs: () => [],
      apiKeyAccountIds: () => []
    })
    const server = new AgentHookServer()
    hook(server, API_TRANSCRIPT)
    expect(server.getStatusSnapshot()[0]).not.toHaveProperty('displayAgentType')
  })
})
