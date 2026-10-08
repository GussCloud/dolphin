import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  applyClaudeChannelLaunch,
  buildClaudeChannelLaunchArgs,
  buildClaudeChannelMcpConfig,
  createClaudeChannelLaunchPolicy,
  shellLiteralConfigPath,
  spliceClaudeChannelArgs,
  writeClaudeChannelMcpConfig
} from './claude-channel-launch'
import {
  isClaudeChannelLaunchGranted,
  isClaudeChannelPty,
  markClaudeChannelPty
} from './claude-channel-panes'

const ARGS =
  '--mcp-config=C:/Users/me/AppData/Roaming/dolphin/telegram-channel/claude-channel-mcp.json --dangerously-load-development-channels=server:dolphin-telegram'
const policy = { launchArgs: () => ARGS }
const base = { env: undefined, connectionId: null, isWsl: false, launchAgent: 'claude' }

describe('shellLiteralConfigPath', () => {
  it('keeps plain paths bare and normalizes Windows separators', () => {
    expect(shellLiteralConfigPath('C:\\Users\\me\\x.json')).toBe('C:/Users/me/x.json')
    expect(shellLiteralConfigPath('/home/me/.config/Dolphin/x.json')).toBe(
      '/home/me/.config/Dolphin/x.json'
    )
  })

  it('double-quotes macOS userData and accented or spaced Windows profiles', () => {
    expect(
      shellLiteralConfigPath(
        '/Users/joão/Library/Application Support/Dolphin/telegram-channel/c.json'
      )
    ).toBe('"/Users/joão/Library/Application Support/Dolphin/telegram-channel/c.json"')
    expect(shellLiteralConfigPath('C:\\Users\\João Silva\\AppData\\Roaming\\dolphin\\c.json')).toBe(
      '"C:/Users/João Silva/AppData/Roaming/dolphin/c.json"'
    )
    expect(shellLiteralConfigPath("/Users/o'neil/x (1)/c.json")).toBe(
      '"/Users/o\'neil/x (1)/c.json"'
    )
  })

  it('refuses characters that some shell still expands inside double quotes', () => {
    for (const path of [
      '/a/$HOME/c.json',
      'C:\\%TEMP%\\c.json',
      '/a/b!c/c.json',
      '/a/`x`/c.json'
    ]) {
      expect(shellLiteralConfigPath(path)).toBeNull()
    }
    expect(buildClaudeChannelLaunchArgs('/a/$b/c.json')).toBeNull()
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
    for (const target of [
      { ...base, command: 'claude', launchAgent: 'codex' },
      { ...base, command: 'claude', connectionId: 'ssh-1' },
      { ...base, command: 'claude', isWsl: true }
    ]) {
      expect(applyClaudeChannelLaunch(target, policy).command).toBe('claude')
    }
  })

  it('grants the pane the channel only for the launch token it was injected with', () => {
    const env = { DOLPHIN_PANE_KEY: 'tab-g:leaf-g', DOLPHIN_AGENT_LAUNCH_TOKEN: 'token-g' }
    applyClaudeChannelLaunch({ ...base, command: 'claude', launchAgent: 'codex', env }, policy)
    expect(isClaudeChannelLaunchGranted('tab-g:leaf-g', 'token-g')).toBe(false)
    applyClaudeChannelLaunch({ ...base, command: 'claude', env }, policy)
    expect(isClaudeChannelLaunchGranted('tab-g:leaf-g', 'token-g')).toBe(true)
    expect(isClaudeChannelLaunchGranted('tab-g:leaf-g', 'token-x')).toBe(false)
    expect(isClaudeChannelLaunchGranted('tab-other:leaf', 'token-g')).toBe(false)
    expect(isClaudeChannelLaunchGranted('tab-g:leaf-g', '')).toBe(false)
    // Only the spawn that carries that very launch is marked as able to show the dialog.
    markClaudeChannelPty('pty-g', env)
    markClaudeChannelPty('pty-other', { ...env, DOLPHIN_AGENT_LAUNCH_TOKEN: 'token-x' })
    markClaudeChannelPty('pty-no-env', undefined)
    expect(isClaudeChannelPty('pty-g')).toBe(true)
    expect(isClaudeChannelPty('pty-other')).toBe(false)
    expect(isClaudeChannelPty('pty-no-env')).toBe(false)
    expect(isClaudeChannelPty(null)).toBe(false)
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
  it('gates on the minimum Claude version and reports why', async () => {
    for (const [version, availability] of [
      ['2.1.294', 'ready'],
      ['2.1.234', 'ready'],
      ['2.1.233', 'claude-too-old'],
      [null, 'claude-not-found']
    ] as const) {
      const writeMcpConfig = vi.fn(() => ARGS)
      const gate = createClaudeChannelLaunchPolicy({
        isEnabled: () => true,
        probeClaudeVersion: async () => version,
        writeMcpConfig
      })
      await gate.refresh()
      expect(gate.availability()).toBe(availability)
      expect(gate.launchArgs()).toBe(availability === 'ready' ? ARGS : null)
      expect(writeMcpConfig).toHaveBeenCalledTimes(availability === 'ready' ? 1 : 0)
    }
  })

  it('reports a config it could not place, and notifies on change', async () => {
    const gate = createClaudeChannelLaunchPolicy({
      isEnabled: () => true,
      probeClaudeVersion: async () => '2.1.294',
      writeMcpConfig: () => null
    })
    const listener = vi.fn()
    gate.onAvailabilityChange(listener)
    expect(gate.availability()).toBe('checking')
    await gate.refresh()
    expect(gate.availability()).toBe('config-unavailable')
    expect(gate.launchArgs()).toBeNull()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('is off while disabled and injects nothing before the first probe settles', async () => {
    let enabled = false
    const gate = createClaudeChannelLaunchPolicy({
      isEnabled: () => enabled,
      probeClaudeVersion: async () => '2.1.294',
      writeMcpConfig: () => ARGS
    })
    expect(gate.availability()).toBe('off')
    expect(gate.launchArgs()).toBeNull()
    enabled = true
    expect(gate.launchArgs()).toBeNull()
    await vi.waitFor(() => expect(gate.launchArgs()).toBe(ARGS))
  })

  it('treats a probe failure as Claude not found', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const gate = createClaudeChannelLaunchPolicy({
      isEnabled: () => true,
      probeClaudeVersion: async () => {
        throw new Error('spawn failed')
      },
      writeMcpConfig: () => ARGS
    })
    await gate.refresh()
    expect(gate.availability()).toBe('claude-not-found')
    warn.mockRestore()
  })
})

describe('writeClaudeChannelMcpConfig', () => {
  const config = buildClaudeChannelMcpConfig({
    execPath: '/opt/Dolphin/dolphin',
    entryPath: '/e.js'
  })

  it('writes to the first candidate whose path can be typed literally', () => {
    const root = mkdtempSync(join(tmpdir(), 'tg channel '))
    try {
      const unusable = join(root, 'has$dollar')
      const usable = join(root, 'Application Support')
      const args = writeClaudeChannelMcpConfig([unusable, usable], config)
      const written = join(usable, 'claude-channel-mcp.json')
      expect(args).toBe(buildClaudeChannelLaunchArgs(written))
      expect(args).toContain('"')
      expect(JSON.parse(readFileSync(written, 'utf8'))).toEqual(config)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('returns null when no candidate can be typed literally', () => {
    expect(writeClaudeChannelMcpConfig(['/a/%x%', '/b/$y'], config)).toBeNull()
  })

  it('runs the entry with the Electron binary of Dolphin in Node mode', () => {
    expect(config).toEqual({
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
