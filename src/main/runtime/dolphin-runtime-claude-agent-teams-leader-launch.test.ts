import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDefaultWorkspaceSession } from '../../shared/constants'
import type { ClaudeAgentTeamsService } from './claude-agent-teams-service'
import type * as ShimEnvModule from './claude-agent-teams-shim-env'
import { DolphinRuntimeService } from './dolphin-runtime'

const shimEnv = vi.hoisted(() => {
  const state: { shimBin: string | null } = { shimBin: 'C:\\dolphin\\dolphin.exe' }
  return state
})

vi.mock('./claude-agent-teams-shim-env', async (importOriginal) => ({
  ...(await importOriginal<typeof ShimEnvModule>()),
  ensureClaudeAgentTeamsShimDir: vi.fn(async () => 'C:\\shim'),
  resolveClaudeAgentTeamsShimBin: vi.fn(() => shimEnv.shimBin),
  resolveClaudeAgentTeamsShimPathDirs: vi.fn((shimDir: string) => ['C:\\bundled-tmux', shimDir])
}))

type RuntimeInternals = {
  issuePtyHandle: (pty: unknown) => string
  ptysById: Map<string, unknown>
  claudeAgentTeams: ClaudeAgentTeamsService
}

const WORKTREE_ID = 'repo-1::C:\\src\\app'
const LEADER_PTY_ID = 'pty-leader'

function createLeader(options: { gitBash: string | null; isWsl?: boolean }) {
  const store = {
    getRepos: () => [],
    getRepo: () => undefined,
    getWorkspaceSession: () => getDefaultWorkspaceSession(),
    setWorkspaceSession: () => {},
    persistPtyBinding: () => true
  }
  const runtime = new DolphinRuntimeService(store as never)
  Object.assign(runtime, { resolveClaudeAgentTeamsGitBash: () => options.gitBash })
  runtime.registerPty(
    LEADER_PTY_ID,
    WORKTREE_ID,
    null,
    { tabId: 'tab-1', leafId: 'leaf-1' },
    options.isWsl ?? false
  )
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: names only private runtime members the leader test reads; each is initialized in the constructor.
  const internals = runtime as unknown as RuntimeInternals
  const handle = internals.issuePtyHandle(internals.ptysById.get(LEADER_PTY_ID))
  const activeTeams = (): number => internals.claudeAgentTeams.getActiveTeamCount()
  return { runtime, handle, activeTeams }
}

describe('prepareClaudeAgentTeamsLeaderForHandle', () => {
  const platform = Object.getOwnPropertyDescriptor(process, 'platform')

  beforeEach(() => {
    Object.defineProperty(process, 'platform', { configurable: true, value: 'win32' })
    shimEnv.shimBin = 'C:\\dolphin\\dolphin.exe'
  })

  afterEach(() => {
    if (platform) {
      Object.defineProperty(process, 'platform', platform)
    }
  })

  it('registers a native-pane team with the bundled tmux dir first on PATH', async () => {
    const { runtime, handle, activeTeams } = createLeader({ gitBash: 'C:\\Git\\bin\\bash.exe' })

    const { env } = await runtime.prepareClaudeAgentTeamsLeaderForHandle({
      handle,
      baseEnv: { Path: 'C:\\Windows' }
    })

    expect(env.TMUX).toEqual(expect.any(String))
    // Why: process.env also feeds the base env, so the host's own PATH spelling may win.
    const pathKey = Object.keys(env).find((key) => /^path$/i.test(key)) ?? ''
    expect(env[pathKey]?.startsWith('C:\\bundled-tmux;C:\\shim;')).toBe(true)
    expect(activeTeams()).toBe(1)
  })

  it('falls back to in-process teammates for a native Windows leader without Git Bash', async () => {
    const { runtime, handle, activeTeams } = createLeader({ gitBash: null })

    const launch = await runtime.prepareClaudeAgentTeamsLeaderForHandle({
      handle,
      baseEnv: { Path: 'C:\\Windows', TMUX: '/tmp/outer,1,0' }
    })

    expect(launch).toEqual({
      env: { CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1' },
      envToDelete: ['TMUX', 'TMUX_PANE']
    })
    expect(activeTeams()).toBe(0)
  })

  it('falls back to in-process teammates when no qualified shim CLI exists', async () => {
    shimEnv.shimBin = null
    const { runtime, handle, activeTeams } = createLeader({ gitBash: 'C:\\Git\\bin\\bash.exe' })

    const launch = await runtime.prepareClaudeAgentTeamsLeaderForHandle({ handle, baseEnv: {} })

    expect(launch.env).not.toHaveProperty('TMUX')
    expect(activeTeams()).toBe(0)
  })

  it('does not need Git Bash for a WSL leader', async () => {
    const { runtime, handle, activeTeams } = createLeader({ gitBash: null, isWsl: true })

    const { env } = await runtime.prepareClaudeAgentTeamsLeaderForHandle({ handle, baseEnv: {} })

    expect(env.TMUX).toEqual(expect.any(String))
    expect(activeTeams()).toBe(1)
  })
})
