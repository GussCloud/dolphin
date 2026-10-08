import { describe, expect, it, vi } from 'vitest'
import {
  applyClaudeChannelLaunch,
  buildClaudeChannelLaunchArgs,
  buildClaudeChannelMcpConfig,
  createClaudeChannelLaunchPolicy,
  spliceClaudeChannelArgs
} from './claude-channel-launch'

const ARGS =
  '--mcp-config=C:/Users/me/AppData/Roaming/dolphin/telegram-channel/claude-channel-mcp.json --dangerously-load-development-channels=server:dolphin-telegram'
const policy = { launchArgs: () => ARGS }
const base = { env: undefined, connectionId: null, isWsl: false, launchAgent: 'claude' }

describe('buildClaudeChannelLaunchArgs', () => {
  it('normalizes Windows separators and rejects paths that would need shell quoting', () => {
    expect(
      buildClaudeChannelLaunchArgs(
        'C:\\Users\\me\\AppData\\Roaming\\dolphin\\telegram-channel\\claude-channel-mcp.json'
      )
    ).toBe(ARGS)
    expect(buildClaudeChannelLaunchArgs('C:\\Users\\Jane Doe\\x.json')).toBeNull()
    expect(buildClaudeChannelLaunchArgs("/home/o'neil/x.json")).toBeNull()
  })
})

describe('spliceClaudeChannelArgs', () => {
  it('inserts right after the claude token so a positional prompt stays positional', () => {
    expect(spliceClaudeChannelArgs("claude --model opus 'fix it'", ARGS)).toBe(
      `claude ${ARGS} --model opus 'fix it'`
    )
    expect(spliceClaudeChannelArgs('claude', ARGS)).toBe(`claude ${ARGS}`)
    expect(spliceClaudeChannelArgs('/usr/local/bin/claude -c', ARGS)).toBe(
      `/usr/local/bin/claude ${ARGS} -c`
    )
    expect(spliceClaudeChannelArgs('claude.exe -- hi', ARGS)).toBe(`claude.exe ${ARGS} -- hi`)
  })

  it('leaves commands it cannot model, or that already opt into channels, alone', () => {
    expect(spliceClaudeChannelArgs('FOO=1 claude', ARGS)).toBeNull()
    expect(spliceClaudeChannelArgs("& 'C:\\Program Files\\claude.exe'", ARGS)).toBeNull()
    expect(spliceClaudeChannelArgs('dolphin claude-teams', ARGS)).toBeNull()
    expect(spliceClaudeChannelArgs('claude --channels plugin:telegram@x', ARGS)).toBeNull()
  })
})

describe('applyClaudeChannelLaunch', () => {
  it('injects for a local Claude launch when the policy allows it', () => {
    expect(applyClaudeChannelLaunch({ ...base, command: 'claude' }, policy).command).toBe(
      `claude ${ARGS}`
    )
  })

  it('is off when channels are disabled or unsupported', () => {
    const off = { launchArgs: () => null }
    expect(applyClaudeChannelLaunch({ ...base, command: 'claude' }, off).command).toBe('claude')
    expect(applyClaudeChannelLaunch({ ...base, command: 'claude' }, null).command).toBe('claude')
  })

  it('skips other agents, SSH panes and WSL panes', () => {
    expect(
      applyClaudeChannelLaunch({ ...base, command: 'claude', launchAgent: 'codex' }, policy).command
    ).toBe('claude')
    expect(
      applyClaudeChannelLaunch({ ...base, command: 'claude', connectionId: 'ssh-1' }, policy)
        .command
    ).toBe('claude')
    expect(
      applyClaudeChannelLaunch({ ...base, command: 'claude', isWsl: true }, policy).command
    ).toBe('claude')
  })

  it('rewrites the sequenced setup command instead of the runner command', () => {
    const result = applyClaudeChannelLaunch(
      {
        ...base,
        command: 'run-setup.cmd',
        env: { DOLPHIN_SEQUENCED_STARTUP_COMMAND: 'claude "go"', KEEP: '1' }
      },
      policy
    )
    expect(result.command).toBe('run-setup.cmd')
    expect(result.env).toEqual({
      DOLPHIN_SEQUENCED_STARTUP_COMMAND: `claude ${ARGS} "go"`,
      KEEP: '1'
    })
  })
})

describe('createClaudeChannelLaunchPolicy', () => {
  const configPath = 'C:\\data\\telegram-channel\\claude-channel-mcp.json'

  it('gates on the minimum Claude version', async () => {
    for (const [version, expected] of [
      ['2.1.294', true],
      ['2.1.234', true],
      ['2.1.233', false],
      [null, false]
    ] as const) {
      const writeMcpConfig = vi.fn(() => configPath)
      const gate = createClaudeChannelLaunchPolicy({
        isEnabled: () => true,
        probeClaudeVersion: async () => version,
        writeMcpConfig
      })
      await gate.refresh()
      expect(gate.launchArgs() !== null).toBe(expected)
      expect(writeMcpConfig).toHaveBeenCalledTimes(expected ? 1 : 0)
    }
  })

  it('returns null while disabled and before the first probe settles', async () => {
    let enabled = false
    const gate = createClaudeChannelLaunchPolicy({
      isEnabled: () => enabled,
      probeClaudeVersion: async () => '2.1.294',
      writeMcpConfig: () => configPath
    })
    expect(gate.launchArgs()).toBeNull()
    enabled = true
    expect(gate.launchArgs()).toBeNull()
    await vi.waitFor(() => expect(gate.launchArgs()).toContain('--mcp-config=C:/data/'))
  })

  it('treats a probe failure as unsupported', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const gate = createClaudeChannelLaunchPolicy({
      isEnabled: () => true,
      probeClaudeVersion: async () => {
        throw new Error('spawn failed')
      },
      writeMcpConfig: () => configPath
    })
    await gate.refresh()
    expect(gate.launchArgs()).toBeNull()
    warn.mockRestore()
  })
})

describe('buildClaudeChannelMcpConfig', () => {
  it('runs the entry with Dolphin’s Electron binary in Node mode', () => {
    expect(
      buildClaudeChannelMcpConfig({ execPath: '/opt/Dolphin/dolphin', entryPath: '/e.js' })
    ).toEqual({
      mcpServers: {
        'dolphin-telegram': {
          type: 'stdio',
          command: '/opt/Dolphin/dolphin',
          args: ['/e.js'],
          env: { ELECTRON_RUN_AS_NODE: '1' }
        }
      }
    })
  })
})
