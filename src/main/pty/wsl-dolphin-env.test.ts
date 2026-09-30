import { describe, expect, it } from 'vitest'
import { isAbsolute } from 'node:path'
import { getShellReadyWrapperRoot } from '../providers/local-pty-shell-ready-wrapper-root'
import {
  SETUP_AGENT_SEQUENCE_STARTUP_COMMAND_ENV,
  SETUP_AGENT_SEQUENCE_STARTUP_SCRIPT_ENV
} from '../../shared/setup-agent-sequencing'
import { addDolphinWslInteropEnv, stampWslOrchestrationCompatibilityHost } from './wsl-dolphin-env'

describe('addDolphinWslInteropEnv', () => {
  it('marks the Dolphin terminal handle for Windows to WSL env import', () => {
    const env: Record<string, string> = { DOLPHIN_TERMINAL_HANDLE: 'term_wsl' }

    addDolphinWslInteropEnv(env)

    expect(env.WSLENV).toBe('DOLPHIN_TERMINAL_HANDLE/u:DOLPHIN_SHELL_READY_ROOT/p')
  })

  // Why this is published at all: the wrapper tree is content-addressed, so the
  // in-guest login script cannot rebuild its path from DOLPHIN_USER_DATA_PATH -- it
  // cannot derive the hash segment. Without this the guest finds no wrapper and
  // every WSL pane launches unwrapped: no ready marker, so every startup command
  // waits out the full readiness timeout.
  it('publishes the resolved wrapper root path-translated for the guest', () => {
    const env: Record<string, string> = {}

    addDolphinWslInteropEnv(env)

    expect(env.DOLPHIN_SHELL_READY_ROOT).toBe(getShellReadyWrapperRoot())
    expect(isAbsolute(env.DOLPHIN_SHELL_READY_ROOT as string)).toBe(true)
    // /p, not /u: the guest reads a Windows path through /mnt/c.
    expect(env.WSLENV?.split(':')).toContain('DOLPHIN_SHELL_READY_ROOT/p')
  })

  it('imports setup-gated startup env into WSL without path translation', () => {
    const env: Record<string, string> = {
      [SETUP_AGENT_SEQUENCE_STARTUP_COMMAND_ENV]: 'codex',
      [SETUP_AGENT_SEQUENCE_STARTUP_SCRIPT_ENV]: 'while :; do sleep 1; done'
    }

    addDolphinWslInteropEnv(env)

    expect(env.WSLENV?.split(':')).toEqual([
      'DOLPHIN_SHELL_READY_ROOT/p',
      `${SETUP_AGENT_SEQUENCE_STARTUP_COMMAND_ENV}/u`,
      `${SETUP_AGENT_SEQUENCE_STARTUP_SCRIPT_ENV}/u`
    ])
  })

  it('preserves existing WSLENV entries and does not duplicate the handle entry', () => {
    const env: Record<string, string> = {
      WSLENV: 'FOO/u:DOLPHIN_TERMINAL_HANDLE/u:BAR/p'
    }

    addDolphinWslInteropEnv(env)

    expect(env.WSLENV).toBe('FOO/u:DOLPHIN_TERMINAL_HANDLE/u:BAR/p:DOLPHIN_SHELL_READY_ROOT/p')
  })

  it('marks OMP status and hook env for Windows to WSL import', () => {
    const env: Record<string, string> = {
      DOLPHIN_TERMINAL_HANDLE: 'term_wsl',
      DOLPHIN_USER_DATA_PATH: 'C:\\Users\\jin\\AppData\\Roaming\\Dolphin',
      DOLPHIN_CLI_COMMAND: 'dolphin-ide',
      DOLPHIN_WSL_CLI_DIR: 'C:\\Users\\jin\\AppData\\Roaming\\Dolphin\\wsl-managed-cli\\hash',
      DOLPHIN_CODEX_LAUNCH_PREFLIGHT: 'C:\\Program Files\\Dolphin\\resources\\bin\\dolphin.exe',
      DOLPHIN_OMP_FRESH_CONFIG: 'C:\\Dolphin\\fresh-session.yml',
      DOLPHIN_OMP_STATUS_EXTENSION:
        'C:\\Users\\jin\\.omp\\agent\\extensions\\dolphin-agent-status.ts',
      DOLPHIN_PRIME_AGENT_STATUS_EXTENSION: 'C:\\stale\\dolphin-agent-status.ts',
      DOLPHIN_PANE_KEY: 'tab-1:leaf-1',
      DOLPHIN_TAB_ID: 'tab-1',
      DOLPHIN_WORKTREE_ID: 'repo::\\\\wsl.localhost\\Ubuntu\\home\\jin\\repo',
      DOLPHIN_AGENT_LAUNCH_TOKEN: 'launch-secret',
      DOLPHIN_OPENCODE_AGENT: 'opencode2',
      DOLPHIN_AGENT_HOOK_PORT: '4567',
      DOLPHIN_AGENT_HOOK_TOKEN: 'token',
      DOLPHIN_AGENT_HOOK_ENV: 'dev',
      DOLPHIN_AGENT_HOOK_VERSION: '1',
      DOLPHIN_AGENT_HOOK_TRANSPORT: 'raw-json-v1',
      DOLPHIN_WSL_HOOK_INSTANCE: 'testinstance',
      DOLPHIN_ORCHESTRATION_COMPATIBILITY_HOST_KIND: 'wsl',
      DOLPHIN_ORCHESTRATION_COMPATIBILITY_HOST_ID: 'local',
      DOLPHIN_ORCHESTRATION_COMPATIBILITY_HOST_INCARNATION: 'Ubuntu'
    }

    addDolphinWslInteropEnv(env)

    expect(env.WSLENV).toContain('DOLPHIN_TERMINAL_HANDLE/u')
    expect(env.WSLENV).toContain('DOLPHIN_USER_DATA_PATH/p')
    expect(env.WSLENV).toContain('DOLPHIN_CLI_COMMAND/u')
    expect(env.WSLENV).toContain('DOLPHIN_WSL_CLI_DIR/p')
    expect(env.WSLENV).toContain('DOLPHIN_CODEX_LAUNCH_PREFLIGHT/p')
    expect(env.WSLENV).toContain('DOLPHIN_OMP_STATUS_EXTENSION/p')
    expect(env.WSLENV).toContain('DOLPHIN_OMP_FRESH_CONFIG/p')
    expect(env.WSLENV).not.toContain('DOLPHIN_PRIME_AGENT_STATUS_EXTENSION')
    expect(env.WSLENV).toContain('DOLPHIN_PANE_KEY/u')
    expect(env.WSLENV).toContain('DOLPHIN_TAB_ID/u')
    expect(env.WSLENV).toContain('DOLPHIN_WORKTREE_ID/u')
    expect(env.WSLENV).toContain('DOLPHIN_AGENT_LAUNCH_TOKEN/u')
    expect(env.WSLENV).toContain('DOLPHIN_OPENCODE_AGENT/u')
    expect(env.WSLENV).toContain('DOLPHIN_AGENT_HOOK_PORT/u')
    expect(env.WSLENV).toContain('DOLPHIN_AGENT_HOOK_TOKEN/u')
    expect(env.WSLENV).toContain('DOLPHIN_AGENT_HOOK_ENV/u')
    expect(env.WSLENV).toContain('DOLPHIN_AGENT_HOOK_VERSION/u')
    expect(env.WSLENV).toContain('DOLPHIN_AGENT_HOOK_TRANSPORT/u')
    expect(env.WSLENV).toContain('DOLPHIN_WSL_HOOK_INSTANCE/u')
    expect(env.WSLENV).toContain('DOLPHIN_ORCHESTRATION_COMPATIBILITY_HOST_KIND/u')
    expect(env.WSLENV).toContain('DOLPHIN_ORCHESTRATION_COMPATIBILITY_HOST_ID/u')
    expect(env.WSLENV).toContain('DOLPHIN_ORCHESTRATION_COMPATIBILITY_HOST_INCARNATION/u')
  })

  it('overwrites caller host evidence with native runtime WSL authority', () => {
    const env = {
      DOLPHIN_ORCHESTRATION_COMPATIBILITY_HOST_KIND: 'ssh',
      DOLPHIN_ORCHESTRATION_COMPATIBILITY_HOST_ID: 'caller-host',
      DOLPHIN_ORCHESTRATION_COMPATIBILITY_HOST_INCARNATION: 'caller-incarnation',
      DOLPHIN_ORCHESTRATION_COMPATIBILITY_ATTACHMENT: 'caller-attachment'
    }

    stampWslOrchestrationCompatibilityHost(env, 'local', 'Ubuntu')

    expect(env).toEqual({
      DOLPHIN_ORCHESTRATION_COMPATIBILITY_HOST_KIND: 'wsl',
      DOLPHIN_ORCHESTRATION_COMPATIBILITY_HOST_ID: 'local',
      DOLPHIN_ORCHESTRATION_COMPATIBILITY_HOST_INCARNATION: 'Ubuntu'
    })
  })

  it('clears inherited host evidence outside a runtime-owned WSL scope', () => {
    const env = {
      DOLPHIN_ORCHESTRATION_COMPATIBILITY_HOST_KIND: 'ssh',
      DOLPHIN_ORCHESTRATION_COMPATIBILITY_HOST_ID: 'caller-host',
      DOLPHIN_ORCHESTRATION_COMPATIBILITY_HOST_INCARNATION: 'caller-incarnation',
      DOLPHIN_ORCHESTRATION_COMPATIBILITY_ATTACHMENT: 'caller-attachment'
    }

    stampWslOrchestrationCompatibilityHost(env, 'local', null)

    expect(env).toEqual({})
  })

  it('path-translates a Windows hook endpoint but passes a guest-side one untouched', () => {
    const windowsEnv: Record<string, string> = {
      DOLPHIN_AGENT_HOOK_ENDPOINT:
        'C:\\Users\\jin\\AppData\\Roaming\\Dolphin\\agent-hooks\\endpoint.cmd'
    }
    addDolphinWslInteropEnv(windowsEnv)
    expect(windowsEnv.WSLENV).toContain('DOLPHIN_AGENT_HOOK_ENDPOINT/p')

    const guestEnv: Record<string, string> = {
      DOLPHIN_AGENT_HOOK_ENDPOINT: '/home/jin/.dolphin-wsl/agent-hooks/port-4567/endpoint.env'
    }
    addDolphinWslInteropEnv(guestEnv)
    expect(guestEnv.WSLENV).toContain('DOLPHIN_AGENT_HOOK_ENDPOINT/u')
    expect(guestEnv.WSLENV).not.toContain('DOLPHIN_AGENT_HOOK_ENDPOINT/p')
  })

  it('tags pre-translated Linux setup paths /u so WSLENV does not translate them again (#9206)', () => {
    const env: Record<string, string> = {
      DOLPHIN_ROOT_PATH: '/home/jin/repo',
      DOLPHIN_WORKTREE_PATH: '/home/jin/repo-worktrees/fix-1',
      DOLPHIN_WORKSPACE_NAME: 'fix-1',
      CONDUCTOR_ROOT_PATH: '/home/jin/repo',
      GHOSTX_ROOT_PATH: '/home/jin/repo'
    }

    addDolphinWslInteropEnv(env)

    // /u (not /p): hooks.ts already converted these to Linux paths before
    // spawn, so a /p flag would make WSLENV double-translate them.
    expect(env.WSLENV).toContain('DOLPHIN_ROOT_PATH/u')
    expect(env.WSLENV).toContain('DOLPHIN_WORKTREE_PATH/u')
    expect(env.WSLENV).toContain('CONDUCTOR_ROOT_PATH/u')
    expect(env.WSLENV).toContain('GHOSTX_ROOT_PATH/u')
    expect(env.WSLENV).not.toContain('DOLPHIN_ROOT_PATH/p')
    expect(env.WSLENV).not.toContain('DOLPHIN_WORKTREE_PATH/p')
    // The value itself must stay the already-Linux path.
    expect(env.DOLPHIN_ROOT_PATH).toBe('/home/jin/repo')
    expect(env.DOLPHIN_WORKTREE_PATH).toBe('/home/jin/repo-worktrees/fix-1')
  })

  it('tags untranslated Windows setup paths /p so WSLENV translates them (wsl.exe shell over a Windows worktree)', () => {
    const env: Record<string, string> = {
      DOLPHIN_ROOT_PATH: 'C:\\Users\\jin\\repo',
      DOLPHIN_WORKTREE_PATH: 'C:\\Users\\jin\\repo-worktrees\\fix-1',
      CONDUCTOR_ROOT_PATH: 'C:\\Users\\jin\\repo',
      GHOSTX_ROOT_PATH: 'C:\\Users\\jin\\repo'
    }

    addDolphinWslInteropEnv(env)

    expect(env.WSLENV).toContain('DOLPHIN_ROOT_PATH/p')
    expect(env.WSLENV).toContain('DOLPHIN_WORKTREE_PATH/p')
    expect(env.WSLENV).toContain('CONDUCTOR_ROOT_PATH/p')
    expect(env.WSLENV).toContain('GHOSTX_ROOT_PATH/p')
    expect(env.WSLENV).not.toContain('DOLPHIN_ROOT_PATH/u')
    expect(env.WSLENV).not.toContain('DOLPHIN_WORKTREE_PATH/u')
  })

  it('always tags DOLPHIN_WORKSPACE_NAME /u because it is a name, not a path', () => {
    const env: Record<string, string> = { DOLPHIN_WORKSPACE_NAME: 'fix-1' }

    addDolphinWslInteropEnv(env)

    expect(env.WSLENV).toBe('DOLPHIN_SHELL_READY_ROOT/p:DOLPHIN_WORKSPACE_NAME/u')
  })

  it('does not register setup vars that are absent from the env', () => {
    const env: Record<string, string> = { DOLPHIN_TERMINAL_HANDLE: 'term_wsl' }

    addDolphinWslInteropEnv(env)

    expect(env.WSLENV).toBe('DOLPHIN_TERMINAL_HANDLE/u:DOLPHIN_SHELL_READY_ROOT/p')
  })

  it('crosses the inline-image protocol hint into the guest untranslated (/u)', () => {
    const env: Record<string, string> = { DOLPHIN_IMAGE_PROTOCOL: 'kitty' }
    addDolphinWslInteropEnv(env)
    expect(env.WSLENV).toContain('DOLPHIN_IMAGE_PROTOCOL/u')
  })

  it('marks the WSL hook relay version for import on relay spawn envs', () => {
    const env: Record<string, string> = {
      DOLPHIN_WSL_HOOK_RELAY_VERSION: '0.1.0+abc'
    }
    addDolphinWslInteropEnv(env)
    expect(env.WSLENV).toBe('DOLPHIN_SHELL_READY_ROOT/p:DOLPHIN_WSL_HOOK_RELAY_VERSION/u')
  })

  it('crosses a guest-side OpenCode config overlay untranslated (/u)', () => {
    const env: Record<string, string> = {
      OPENCODE_CONFIG_DIR: '/home/jin/.dolphin-relay/opencode-overlays/abc',
      DOLPHIN_OPENCODE_CONFIG_DIR: '/home/jin/.dolphin-relay/opencode-overlays/abc'
    }
    addDolphinWslInteropEnv(env)
    expect(env.WSLENV).toContain('OPENCODE_CONFIG_DIR/u')
    expect(env.WSLENV).toContain('DOLPHIN_OPENCODE_CONFIG_DIR/u')
    expect(env.WSLENV).not.toContain('OPENCODE_CONFIG_DIR/p')
  })

  it('never crosses a Windows OpenCode config dir into the guest', () => {
    // Why: the relay spawn env spreads process.env and the daemon inherits its
    // own — a /p entry here would deliver C:\... as /mnt/c and in-guest OpenCode
    // would adopt Dolphin's Windows overlay as its config root.
    const env: Record<string, string> = {
      OPENCODE_CONFIG_DIR: 'C:\\Users\\jin\\AppData\\Roaming\\Dolphin\\opencode-overlays\\abc',
      DOLPHIN_OPENCODE_CONFIG_DIR:
        'C:\\Users\\jin\\AppData\\Roaming\\Dolphin\\opencode-overlays\\abc'
    }
    addDolphinWslInteropEnv(env)
    expect(env.WSLENV).not.toContain('OPENCODE_CONFIG_DIR')
    expect(env.WSLENV).not.toContain('DOLPHIN_OPENCODE_CONFIG_DIR')
  })

  it('does not register the OpenCode config vars when they are absent', () => {
    const env: Record<string, string> = { DOLPHIN_TERMINAL_HANDLE: 'term_wsl' }
    addDolphinWslInteropEnv(env)
    expect(env.WSLENV).not.toContain('OPENCODE_CONFIG_DIR')
    expect(env.WSLENV).not.toContain('DOLPHIN_OPENCODE_CONFIG_DIR')
  })

  it('forwards an Agent Teams pane its team coordinates but never the Windows shim or PATH', () => {
    const env: Record<string, string> = {
      Path: 'C:\\Users\\jin\\.dolphin\\claude-agent-teams-bin;C:\\Windows',
      TMUX: '/tmp/dolphin-claude-agent-teams/team-1,0,1',
      TMUX_PANE: '%2',
      TERM: 'screen-256color',
      COLORTERM: 'truecolor',
      CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1',
      DOLPHIN_AGENT_TEAMS_TEAM_ID: 'team-1',
      DOLPHIN_AGENT_TEAMS_TOKEN: 'secret',
      DOLPHIN_AGENT_TEAMS_LEADER_PANE: '%1',
      DOLPHIN_AGENT_TEAMS_SHIM_DIR: 'C:\\Users\\jin\\.dolphin\\claude-agent-teams-bin',
      DOLPHIN_AGENT_TEAMS_SHIM_BIN: 'C:\\Dolphin\\dolphin.exe'
    }

    addDolphinWslInteropEnv(env)

    const entries = env.WSLENV.split(':')
    for (const name of [
      'TMUX',
      'TMUX_PANE',
      'TERM',
      'COLORTERM',
      'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS',
      'DOLPHIN_AGENT_TEAMS_TEAM_ID',
      'DOLPHIN_AGENT_TEAMS_TOKEN',
      'DOLPHIN_AGENT_TEAMS_LEADER_PANE'
    ]) {
      expect(entries).toContain(`${name}/u`)
    }
    expect(env.WSLENV).not.toMatch(
      /(^|:)(PATH|Path|DOLPHIN_AGENT_TEAMS_SHIM_DIR|DOLPHIN_AGENT_TEAMS_SHIM_BIN)(\/|:|$)/
    )
  })

  it('keeps TERM and TMUX out of ordinary WSL panes', () => {
    const env: Record<string, string> = {
      TMUX: '/tmp/tmux-1000/default,1,0',
      TERM: 'xterm-256color',
      CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1'
    }

    addDolphinWslInteropEnv(env)

    expect(env.WSLENV).not.toMatch(/(^|:)(TMUX|TERM|CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS)\//)
  })
})
