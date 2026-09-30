import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as ShimEnv from './claude-agent-teams-shim-env'

vi.mock('./claude-agent-teams-shim-env', async (importOriginal) => ({
  ...(await importOriginal<typeof ShimEnv>()),
  ensureClaudeAgentTeamsShimDir: vi.fn(async () => 'C:\\shim'),
  // Why: the real resolver's `isAbsolute` follows the host OS, so a `C:\` path is relative on Linux CI.
  resolveClaudeAgentTeamsShimBin: vi.fn(() => 'C:\\dolphin.exe'),
  resolveClaudeAgentTeamsShimPathDirs: vi.fn((shimDir: string) => [shimDir])
}))

import { DolphinRuntimeService } from './dolphin-runtime'

class GitBashRuntime extends DolphinRuntimeService {
  protected override resolveClaudeAgentTeamsGitBash(): string | null {
    return 'C:\\Git\\bin\\bash.exe'
  }
}

describe('prepareClaudeAgentTeamsLeaderForHandle PATH', () => {
  const platform = Object.getOwnPropertyDescriptor(process, 'platform')

  beforeEach(() => {
    Object.defineProperty(process, 'platform', { configurable: true, value: 'win32' })
    vi.stubEnv('Path', 'C:\\electron-main')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    if (platform) {
      Object.defineProperty(process, 'platform', platform)
    }
  })

  it("builds the leader PATH from the pane's `PATH`, not main's `Path`", async () => {
    const { env } = await new GitBashRuntime().prepareClaudeAgentTeamsLeaderForHandle({
      handle: 'leader-handle',
      baseEnv: { PATH: 'C:\\pane', DOLPHIN_AGENT_TEAMS_SHIM_BIN: 'C:\\dolphin.exe' }
    })

    expect(Object.keys(env).filter((key) => /^path$/i.test(key))).toEqual(['PATH'])
    expect(env.PATH).toBe('C:\\shim;C:\\pane')
    expect(env.DOLPHIN_AGENT_TEAMS_TEAM_ID).toMatch(/^team-/)
  })
})
