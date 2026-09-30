import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatClaudeAgentTeamsWslGuestEnv } from '../../shared/claude-agent-teams-wsl-guest-env'
import { prepareClaudeAgentTeamsWslGuestEnv } from './claude-agent-teams-wsl-env'

const ENV_KEYS = ['DOLPHIN_PANE_KEY', 'DOLPHIN_CLI_WSL_DISTRO', 'ELECTRON_RUN_AS_NODE'] as const

describe('formatClaudeAgentTeamsWslGuestEnv', () => {
  it('emits only guest-safe team keys, never PATH or Windows shim paths', () => {
    expect(
      formatClaudeAgentTeamsWslGuestEnv({
        Path: 'C:\\Users\\me\\.dolphin\\claude-agent-teams-bin;C:\\Windows',
        CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1',
        TMUX: '/tmp/dolphin-claude-agent-teams/team-1,0,1',
        TMUX_PANE: '%1',
        TERM: 'screen-256color',
        DOLPHIN_AGENT_TEAMS_TEAM_ID: 'team-1',
        DOLPHIN_AGENT_TEAMS_TOKEN: 'tok-_',
        DOLPHIN_AGENT_TEAMS_SHIM_DIR: 'C:\\Users\\me\\.dolphin\\claude-agent-teams-bin',
        DOLPHIN_AGENT_TEAMS_SHIM_BIN: 'C:\\Dolphin\\dolphin.exe'
      })
    ).toBe(
      [
        "export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS='1'",
        "export TMUX='/tmp/dolphin-claude-agent-teams/team-1,0,1'",
        "export TMUX_PANE='%1'",
        "export TERM='screen-256color'",
        "export DOLPHIN_AGENT_TEAMS_TEAM_ID='team-1'",
        "export DOLPHIN_AGENT_TEAMS_TOKEN='tok-_'",
        ''
      ].join('\n')
    )
  })

  it('refuses a value the guest filter could not carry verbatim', () => {
    expect(() => formatClaudeAgentTeamsWslGuestEnv({ TMUX: "/tmp/it's,0,1" })).toThrow(
      'cannot cross into WSL'
    )
    expect(() => formatClaudeAgentTeamsWslGuestEnv({ TERM: 'x\nexport PATH=/evil' })).toThrow()
  })
})

describe('prepareClaudeAgentTeamsWslGuestEnv', () => {
  const saved = new Map<string, string | undefined>()
  const originalPlatform = process.platform
  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved.set(key, process.env[key])
      delete process.env[key]
    }
    Object.defineProperty(process, 'platform', { configurable: true, value: 'win32' })
  })
  afterEach(() => {
    for (const [key, value] of saved) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
    Object.defineProperty(process, 'platform', { configurable: true, value: originalPlatform })
  })

  it('mints the team for the calling WSL pane without Windows Claude auth', async () => {
    process.env.DOLPHIN_PANE_KEY = 'tab-1:leaf-1'
    process.env.DOLPHIN_CLI_WSL_DISTRO = 'Ubuntu'
    process.env.ELECTRON_RUN_AS_NODE = '1'
    const call = vi.fn().mockResolvedValue({
      result: {
        launch: {
          env: { TMUX: '/tmp/x,0,1', DOLPHIN_AGENT_TEAMS_TEAM_ID: 'team-1', Path: 'C:\\w' }
        }
      }
    })

    await expect(
      prepareClaudeAgentTeamsWslGuestEnv({ call }, '\\\\wsl.localhost\\Ubuntu\\home\\me\\repo')
    ).resolves.toBe("export TMUX='/tmp/x,0,1'\nexport DOLPHIN_AGENT_TEAMS_TEAM_ID='team-1'\n")
    expect(call).toHaveBeenCalledWith('agentTeams.prepareLaunch', {
      paneKey: 'tab-1:leaf-1',
      env: expect.not.objectContaining({ ELECTRON_RUN_AS_NODE: '1' })
    })
    expect(call.mock.calls[0]?.[1]).not.toHaveProperty('prepareAuth')
  })

  it('refuses callers outside a WSL terminal or without a pane', async () => {
    const call = vi.fn()
    process.env.DOLPHIN_PANE_KEY = 'tab-1:leaf-1'
    await expect(prepareClaudeAgentTeamsWslGuestEnv({ call }, 'C:\\repo')).rejects.toMatchObject({
      code: 'invalid_environment'
    })
    delete process.env.DOLPHIN_PANE_KEY
    process.env.DOLPHIN_CLI_WSL_DISTRO = 'Ubuntu'
    await expect(prepareClaudeAgentTeamsWslGuestEnv({ call }, '/mnt/c/repo')).rejects.toMatchObject(
      {
        code: 'invalid_environment'
      }
    )
    expect(call).not.toHaveBeenCalled()
  })
})
