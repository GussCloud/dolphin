import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { prepareDeepSeekLaunch } from './deepseek-config-home-setup'

const installHooksMock = vi.hoisted(() => vi.fn())
const launchEnvMock = vi.hoisted(() => ({ resolveDeepSeekLaunchEnv: vi.fn() }))
vi.mock('./deepseek-hook-service', () => ({ installDeepSeekHooks: installHooksMock }))
vi.mock('./deepseek-launch-env', () => launchEnvMock)
const runWslProcessMock = vi.hoisted(() => vi.fn())
vi.mock('../wsl/wsl-runner', () => ({ runWslProcess: runWslProcessMock }))

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

  it('drops the compact window for a pane launched with auto-compaction off', async () => {
    const configDir = makeConfigDir()
    launchEnvMock.resolveDeepSeekLaunchEnv.mockClear()
    launchEnvMock.resolveDeepSeekLaunchEnv.mockReturnValue({
      env: {},
      configHome: { processConfigDir: configDir, hostConfigDir: configDir, wslDistro: null }
    })
    await prepareDeepSeekLaunch({
      connectionId: null,
      target: { runtime: 'host' },
      settings: { agentStatusHooksEnabled: false },
      launchEnv: { DISABLE_AUTO_COMPACT: '1' }
    })
    expect(launchEnvMock.resolveDeepSeekLaunchEnv).toHaveBeenCalledWith(
      expect.objectContaining({ autoCompact: false })
    )
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

  it('narrows a freshly seeded WSL guest state file inside the guest, once', async () => {
    const hostConfigDir = makeConfigDir()
    runWslProcessMock.mockReset()
    runWslProcessMock.mockResolvedValue({ code: 0, stdout: '', stderr: '' })
    launchEnvMock.resolveDeepSeekLaunchEnv.mockReturnValue({
      env: {},
      configHome: {
        processConfigDir: '/home/u/.claude-deepseek',
        hostConfigDir,
        wslDistro: 'Ubuntu'
      }
    })
    const launch = {
      connectionId: null,
      target: { runtime: 'wsl', wslDistro: 'Ubuntu' },
      settings: { agentStatusHooksEnabled: false }
    } as const
    await prepareDeepSeekLaunch(launch)
    await prepareDeepSeekLaunch(launch)
    expect(runWslProcessMock.mock.calls).toEqual([
      [
        expect.objectContaining({
          distro: 'Ubuntu',
          program: 'chmod',
          args: ['600', '--', '/home/u/.claude-deepseek/.claude.json']
        })
      ]
    ])
  })
})
