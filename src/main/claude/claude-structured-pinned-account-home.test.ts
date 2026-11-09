import { describe, expect, it, vi } from 'vitest'
import type { AgentSessionRecord } from '../../shared/agent-session-record'
import { LOCAL_EXECUTION_HOST_ID } from '../../shared/execution-host'
import type { AgentSessionRecordStore } from '../runtime/agent-session-record-store'
import { createClaudeStructuredLaunchResolver } from './claude-structured-launch-resolution'

const PINNED_HOME = '/data/claude-accounts/acct-pinned/config'
// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the resolver reads only the session id of the identity.
const IDENTITY = { sessionId: 'dolphin-session-pinned' } as Parameters<
  ReturnType<typeof createClaudeStructuredLaunchResolver>
>[0]['identity']

function record(): AgentSessionRecord {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the resolver reads only location, accountHome and providerHandleChain.
  return {
    sessionId: 'dolphin-session-pinned',
    provider: 'claude',
    location: {
      executionHostId: LOCAL_EXECUTION_HOST_ID,
      wslDistro: null,
      workspaceId: 'workspace-1',
      workspaceKind: 'git-worktree'
    },
    accountHome: { variable: 'CLAUDE_CONFIG_DIR', path: PINNED_HOME },
    providerHandleChain: []
  } as unknown as AgentSessionRecord
}

function resolverFor(preparePinnedAccountHome: (configDir: string) => Promise<boolean>) {
  return createClaudeStructuredLaunchResolver({
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the resolver only calls getRecord.
    store: { getRecord: () => record() } as unknown as AgentSessionRecordStore,
    resolveWorkspacePath: async (id) => `/repos/${id}`,
    resolveCommand: () => '/usr/local/bin/claude',
    // The global account is the system login, which would keep ambient API keys.
    resolveAuthPolicy: () => ({ stripAuthEnv: false }),
    resolveInheritedEnv: async () => ({ PATH: '/usr/bin', ANTHROPIC_API_KEY: 'sk-ant-AMBIENT' }),
    preparePinnedAccountHome,
    hasTranscript: async () => false
  })
}

describe('structured Claude on a worktree-pinned account home', () => {
  it('re-materializes the pinned home and launches only on its credential', async () => {
    const prepare = vi.fn(async () => true)

    const launch = await resolverFor(prepare)({ identity: IDENTITY })

    expect(prepare).toHaveBeenCalledWith(PINNED_HOME)
    expect(launch.claudeConfigDir).toBe(PINNED_HOME)
    expect(launch.env?.ANTHROPIC_API_KEY).toBeUndefined()
  })

  it('keeps the global policy for a home that is not pinned', async () => {
    const launch = await resolverFor(async () => false)({ identity: IDENTITY })

    expect(launch.env?.ANTHROPIC_API_KEY).toBe('sk-ant-AMBIENT')
  })

  it('refuses to spawn when the pinned account is gone', async () => {
    await expect(
      resolverFor(async () => {
        throw new Error('The Claude account this chat was pinned to is no longer available.')
      })({ identity: IDENTITY })
    ).rejects.toThrow('no longer available')
  })
})
