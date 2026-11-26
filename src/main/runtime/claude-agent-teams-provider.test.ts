import { describe, expect, it } from 'vitest'
import {
  CLAUDE_API_ACCOUNT_ENV_KEY,
  CLAUDE_API_PROVIDER_ENV_KEY,
  CLAUDE_API_PROVIDER_ENV_VALUE
} from '../../shared/claude-api-provider'
import { resolveAgentTeamLaunchProvider } from './claude-agent-teams-provider'

const MARKER = {
  [CLAUDE_API_PROVIDER_ENV_KEY]: CLAUDE_API_PROVIDER_ENV_VALUE,
  [CLAUDE_API_ACCOUNT_ENV_KEY]: 'api1'
}

describe('resolveAgentTeamLaunchProvider', () => {
  it("ignores an API-key marker that only main's own env carries", () => {
    // Dolphin started from an API-key pane: main's env (merged into baseEnv) has the marker.
    const provider = resolveAgentTeamLaunchProvider({
      baseEnv: { PATH: '/usr/bin', ...MARKER },
      paneEnv: { PATH: '/usr/bin' },
      launchAgent: 'claude-agent-teams'
    })
    expect(provider).toEqual({ inProcess: false, launch: { deepSeekProvider: false } })
  })

  it('classifies a leader whose pane env carries the marker as an API-key team', () => {
    const provider = resolveAgentTeamLaunchProvider({
      baseEnv: { PATH: '/usr/bin', ...MARKER },
      paneEnv: MARKER,
      launchAgent: undefined
    })
    expect(provider).toEqual({
      inProcess: false,
      launch: { deepSeekProvider: false, claudeApiAccountId: 'api1' }
    })
  })
})
