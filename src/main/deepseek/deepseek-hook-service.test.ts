import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import type { AgentHookInstallStatus } from '../../shared/agent-hook-types'
import type * as NodeOs from 'node:os'

const fakeHome = vi.hoisted(() => ({ path: '' }))
vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof NodeOs>()
  return { ...actual, homedir: () => fakeHome.path }
})

const { tmpdir } = await vi.importActual<typeof NodeOs>('node:os')
fakeHome.path = mkdtempSync(join(tmpdir(), 'deepseek-hooks-'))
const { deepSeekHookService, installDeepSeekHooks } = await import('./deepseek-hook-service')
const { DEEPSEEK_HOOK_SETTINGS, OPENCLAUDE_HOOK_SETTINGS, getManagedScriptPath } =
  await import('../claude/hook-settings')

afterAll(() => {
  rmSync(fakeHome.path, { recursive: true, force: true })
})

const SESSION_END_VERSION = '2.1.309'
const hostConfigDir = join(fakeHome.path, '.claude-deepseek')
const hostHome = { processConfigDir: hostConfigDir, hostConfigDir, wslDistro: null }

function status(state: AgentHookInstallStatus['state']): AgentHookInstallStatus {
  return { agent: 'openclaude', state, configPath: '', managedHooksPresent: false, detail: null }
}

function fakeService() {
  return {
    install: vi.fn((_options?: { claudeVersion?: string }) => status('installed')),
    installRemote: vi.fn(
      async (_sftp: unknown, _home: string, _options?: { claudeVersion?: string }) =>
        status('installed')
    )
  }
}

function realDeps(claudeVersion: string | null) {
  return {
    service: deepSeekHookService,
    hostClaudeVersion: async () => claudeVersion,
    wslClaudeVersion: () => null
  }
}

function readSettings(): { hooks: Record<string, unknown>; statusLine?: unknown } {
  return JSON.parse(readFileSync(join(hostConfigDir, 'settings.json'), 'utf8'))
}

describe('installDeepSeekHooks', () => {
  it('refreshes a stale script on the first launch and leaves ~/.claude alone', async () => {
    const scriptPath = getManagedScriptPath(DEEPSEEK_HOOK_SETTINGS)
    mkdirSync(dirname(scriptPath), { recursive: true })
    writeFileSync(scriptPath, 'stale script from an older Dolphin')
    await installDeepSeekHooks(hostHome, undefined, realDeps(null))
    expect(readFileSync(scriptPath, 'utf8')).not.toContain('stale script')
    const settings = readSettings()
    expect(Object.keys(settings.hooks)).toEqual(
      expect.arrayContaining(['SessionStart', 'UserPromptSubmit', 'Stop', 'PermissionRequest'])
    )
    expect(JSON.stringify(settings.hooks)).toContain('deepseek-hook')
    // Unknown claude version: SessionEnd is withheld, exactly as for Claude itself.
    expect(settings.hooks.SessionEnd).toBeUndefined()
    // The statusline feeds Claude's usage meter; DeepSeek traffic must not reach it.
    expect(settings.statusLine).toBeUndefined()
    expect(existsSync(join(fakeHome.path, '.claude', 'settings.json'))).toBe(false)
  })

  it('adds SessionEnd once a capable claude version is known', async () => {
    await installDeepSeekHooks(hostHome, undefined, realDeps(SESSION_END_VERSION))
    expect(readSettings().hooks.SessionEnd).toBeDefined()
  })

  it('does not reinstall on the host for the same claude version', async () => {
    const service = fakeService()
    await installDeepSeekHooks(hostHome, undefined, {
      ...realDeps(SESSION_END_VERSION),
      service
    })
    expect(service.install).not.toHaveBeenCalled()
  })

  it('gives DeepSeek the version-gated events but not OpenClaude', () => {
    expect(DEEPSEEK_HOOK_SETTINGS.claudeVersionGatedEvents).toBe(true)
    expect(OPENCLAUDE_HOOK_SETTINGS.claudeVersionGatedEvents).toBe(false)
  })

  it('retries a failed install on the next launch instead of memoizing it', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const service = fakeService()
    service.installRemote.mockResolvedValueOnce(status('error'))
    const home = {
      processConfigDir: '/home/me/.claude-deepseek',
      hostConfigDir: join('\\\\wsl.localhost\\Retry-test\\home\\me', '.claude-deepseek'),
      wslDistro: 'Retry-test'
    }
    const deps = { ...realDeps(null), service }
    await installDeepSeekHooks(home, undefined, deps)
    await installDeepSeekHooks(home, undefined, deps)
    await installDeepSeekHooks(home, undefined, deps)
    expect(service.installRemote).toHaveBeenCalledTimes(2)
  })

  it('installs WSL hooks through the POSIX installer once per distro and version', async () => {
    const service = fakeService()
    let wslVersion: string | null = null
    const deps = { ...realDeps(null), service, wslClaudeVersion: () => wslVersion }
    const home = {
      processConfigDir: '/home/me/.claude-deepseek',
      hostConfigDir: join('\\\\wsl.localhost\\Ubuntu-test\\home\\me', '.claude-deepseek'),
      wslDistro: 'Ubuntu-test'
    }
    await installDeepSeekHooks(home, undefined, deps)
    await installDeepSeekHooks(home, undefined, deps)
    expect(service.installRemote).toHaveBeenCalledTimes(1)
    expect(service.installRemote).toHaveBeenLastCalledWith(
      expect.anything(),
      '\\\\wsl.localhost\\Ubuntu-test\\home\\me',
      {}
    )
    wslVersion = SESSION_END_VERSION
    await installDeepSeekHooks(home, undefined, deps)
    expect(service.installRemote).toHaveBeenCalledTimes(2)
    expect(service.installRemote).toHaveBeenLastCalledWith(expect.anything(), expect.any(String), {
      claudeVersion: SESSION_END_VERSION
    })
    expect(service.install).not.toHaveBeenCalled()
  })
})
