import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { prepareDeepSeekLaunch } from './deepseek-config-home-setup'

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
