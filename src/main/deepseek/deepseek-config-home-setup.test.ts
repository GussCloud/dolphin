import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { prepareDeepSeekLaunch, seedDeepSeekClaudeOnboarding } from './deepseek-config-home-setup'

const installHooksMock = vi.hoisted(() => vi.fn())
const launchEnvMock = vi.hoisted(() => ({ resolveDeepSeekLaunchEnv: vi.fn() }))
vi.mock('./deepseek-hook-service', () => ({ installDeepSeekHooks: installHooksMock }))
vi.mock('./deepseek-launch-env', () => launchEnvMock)

const tempDirs: string[] = []

function makeConfigDir(): string {
  const root = mkdtempSync(join(tmpdir(), 'deepseek-home-'))
  tempDirs.push(root)
  return join(root, '.claude-deepseek')
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('seedDeepSeekClaudeOnboarding', () => {
  it('creates the config dir and marks onboarding done', () => {
    const configDir = makeConfigDir()
    seedDeepSeekClaudeOnboarding(configDir)
    expect(JSON.parse(readFileSync(join(configDir, '.claude.json'), 'utf8'))).toEqual({
      hasCompletedOnboarding: true
    })
  })

  it('never touches an existing file, even one without the flag', () => {
    const configDir = makeConfigDir()
    seedDeepSeekClaudeOnboarding(configDir)
    for (const existing of ['{"userID":"u1"}', '{ not json']) {
      writeFileSync(join(configDir, '.claude.json'), existing)
      seedDeepSeekClaudeOnboarding(configDir)
      expect(readFileSync(join(configDir, '.claude.json'), 'utf8')).toBe(existing)
    }
  })
})

describe('prepareDeepSeekLaunch', () => {
  it('still returns the launch env when the hook install throws', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const configDir = makeConfigDir()
    const env = { ANTHROPIC_AUTH_TOKEN: 'sk' }
    launchEnvMock.resolveDeepSeekLaunchEnv.mockReturnValue({
      env,
      configHome: { processConfigDir: configDir, hostConfigDir: configDir, wslDistro: null }
    })
    installHooksMock.mockRejectedValue(new Error('EACCES'))
    await expect(
      prepareDeepSeekLaunch({ connectionId: null, target: { runtime: 'host' }, settings: {} })
    ).resolves.toBe(env)
    expect(installHooksMock).toHaveBeenCalledTimes(1)
  })

  it('skips the hook install when status hooks are off', async () => {
    installHooksMock.mockClear()
    const configDir = makeConfigDir()
    launchEnvMock.resolveDeepSeekLaunchEnv.mockReturnValue({
      env: {},
      configHome: { processConfigDir: configDir, hostConfigDir: configDir, wslDistro: null }
    })
    await prepareDeepSeekLaunch({
      connectionId: null,
      target: { runtime: 'host' },
      settings: { agentStatusHooksEnabled: false }
    })
    expect(installHooksMock).not.toHaveBeenCalled()
  })
})
