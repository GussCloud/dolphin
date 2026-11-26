import { describe, expect, it, vi } from 'vitest'
import type * as ShimEnv from './claude-agent-teams-shim-env'
import {
  CLAUDE_API_ACCOUNT_ENV_KEY,
  CLAUDE_API_PROVIDER_ENV_KEY,
  CLAUDE_API_PROVIDER_ENV_VALUE
} from '../../shared/claude-api-provider'

vi.mock('./claude-agent-teams-shim-env', async (importOriginal) => ({
  ...(await importOriginal<typeof ShimEnv>()),
  ensureClaudeAgentTeamsShimDir: vi.fn(async () => '/shim'),
  resolveClaudeAgentTeamsShimBin: vi.fn(() => '/usr/bin/dolphin'),
  resolveClaudeAgentTeamsLaunchShimPathDirs: vi.fn(async (args: { shimDir: string }) => [
    args.shimDir
  ])
}))

import { DolphinRuntimeService } from './dolphin-runtime'

// A fake key: it stands for the key the leader's spawn env carries.
const FAKE_KEY = 'sk-ant-fake-leader-key-0000000000'

/** The pane env of an API-key leader after its spawn resolved account `api1`. */
function leaderEnv(extra: Record<string, string> = {}): Record<string, string> {
  return {
    PATH: '/usr/bin',
    CLAUDE_CONFIG_DIR: '/profiles/api1/config',
    ANTHROPIC_API_KEY: FAKE_KEY,
    [CLAUDE_API_PROVIDER_ENV_KEY]: CLAUDE_API_PROVIDER_ENV_VALUE,
    [CLAUDE_API_ACCOUNT_ENV_KEY]: 'api1',
    ...extra
  }
}

describe.skipIf(process.platform === 'win32')('API-key Agent Teams leader', () => {
  it('registers a native-pane team that carries the marker and account, never the key', async () => {
    const runtime = new DolphinRuntimeService()
    const prepared = await runtime.prepareClaudeAgentTeamsLeaderForHandle({
      handle: 'leader-handle',
      baseEnv: leaderEnv()
    })

    expect(prepared.env.DOLPHIN_AGENT_TEAMS_TEAM_ID).toMatch(/^team-/)
    expect(prepared.env[CLAUDE_API_PROVIDER_ENV_KEY]).toBe(CLAUDE_API_PROVIDER_ENV_VALUE)
    expect(prepared.env[CLAUDE_API_ACCOUNT_ENV_KEY]).toBe('api1')
    expect(JSON.stringify(prepared.env)).not.toContain(FAKE_KEY)
    expect(prepared.env.CLAUDE_CONFIG_DIR).toBeUndefined()
  })

  it('keeps teammates in-process when the team routes to a remote runtime', async () => {
    const runtime = new DolphinRuntimeService()
    const prepared = await runtime.prepareClaudeAgentTeamsLeaderForHandle({
      handle: 'leader-handle',
      baseEnv: leaderEnv({ DOLPHIN_PAIRING_CODE: 'abc' })
    })

    expect(prepared.env).toEqual({ CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1' })
    expect(prepared.envToDelete).toEqual(expect.arrayContaining(['TMUX', 'TMUX_PANE']))
  })

  it('keeps teammates in-process when the leader account is unknown', async () => {
    const runtime = new DolphinRuntimeService()
    const { [CLAUDE_API_ACCOUNT_ENV_KEY]: _account, ...withoutAccount } = leaderEnv()
    const prepared = await runtime.prepareClaudeAgentTeamsLeaderForHandle({
      handle: 'leader-handle',
      baseEnv: withoutAccount
    })

    expect(prepared.env).toEqual({ CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1' })
  })
})
