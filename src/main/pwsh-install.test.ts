import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProcessResult } from '../shared/child-process/run-process'
import { PWSH_WINGET_INSTALL_ARGS } from '../shared/pwsh-install'

vi.mock('./pwsh', () => ({ refreshPwshAvailability: vi.fn() }))
vi.mock('./daemon/daemon-session-inventory', () => ({ refreshDaemonPwshAvailability: vi.fn() }))

const ok: ProcessResult = { code: 0, signal: null, stdout: 'v1.9.0', stderr: '', timedOut: false }

function result(overrides: Partial<ProcessResult>): ProcessResult {
  return { ...ok, ...overrides }
}

const env = { LOCALAPPDATA: String.raw`C:\Users\me\AppData\Local` }
const wingetAlias = String.raw`C:\Users\me\AppData\Local\Microsoft\WindowsApps\winget.exe`

async function loadInstaller() {
  vi.resetModules()
  return import('./pwsh-install')
}

describe('installPwshWithWinget', () => {
  const run = vi.fn()
  const refresh = vi.fn()
  const refreshDaemon = vi.fn()
  const deps = {
    platform: 'win32' as const,
    env,
    wingetAliasExists: () => true,
    run,
    refresh,
    refreshDaemon
  }

  beforeEach(() => {
    run.mockReset()
    refresh.mockReset()
    refreshDaemon.mockReset()
    refreshDaemon.mockResolvedValue(undefined)
  })

  it('never runs anything off Windows', async () => {
    const { installPwshWithWinget } = await loadInstaller()
    await expect(installPwshWithWinget({ ...deps, platform: 'darwin' })).resolves.toEqual({
      status: 'unsupported'
    })
    expect(run).not.toHaveBeenCalled()
  })

  it('installs with the documented winget command and re-probes pwsh', async () => {
    run.mockResolvedValueOnce(ok).mockResolvedValueOnce(ok)
    refresh.mockResolvedValue(true)
    const { installPwshWithWinget } = await loadInstaller()

    await expect(installPwshWithWinget(deps)).resolves.toEqual({
      status: 'installed',
      pwshAvailable: true
    })
    expect(run).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ program: wingetAlias, args: ['--version'] })
    )
    expect(run).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        program: wingetAlias,
        args: PWSH_WINGET_INSTALL_ARGS,
        timeoutMs: 15 * 60_000,
        signal: expect.any(AbortSignal)
      })
    )
    expect(refresh).toHaveBeenCalledTimes(1)
    // New terminals spawn in the daemon, so its pwsh cache must be refreshed before success shows.
    expect(refreshDaemon).toHaveBeenCalledTimes(1)
  })

  it('still reports success when the daemon cannot be refreshed', async () => {
    run.mockResolvedValueOnce(ok).mockResolvedValueOnce(ok)
    refresh.mockResolvedValue(true)
    refreshDaemon.mockRejectedValue(new Error('daemon down'))
    const { installPwshWithWinget } = await loadInstaller()
    await expect(installPwshWithWinget(deps)).resolves.toEqual({
      status: 'installed',
      pwshAvailable: true
    })
  })

  it('reports winget as unavailable when it is not on this machine', async () => {
    run.mockRejectedValueOnce(
      Object.assign(new Error('spawn winget.exe ENOENT'), { code: 'ENOENT' })
    )
    const { installPwshWithWinget } = await loadInstaller()

    await expect(
      installPwshWithWinget({ ...deps, wingetAliasExists: () => false })
    ).resolves.toEqual({ status: 'winget-unavailable' })
    expect(run).toHaveBeenCalledWith(expect.objectContaining({ program: 'winget.exe' }))
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('reports winget as unavailable when its version probe fails', async () => {
    run.mockResolvedValueOnce(result({ code: 1 }))
    const { installPwshWithWinget } = await loadInstaller()
    await expect(installPwshWithWinget(deps)).resolves.toEqual({ status: 'winget-unavailable' })
  })

  it('surfaces winget output on a non-zero exit when pwsh is still missing', async () => {
    run.mockResolvedValueOnce(ok).mockResolvedValueOnce(
      result({
        code: -1978335212,
        stdout:
          '   - \\ | \r\n  ██████  1.2 MB / 110 MB\r\nNo package found matching input criteria.\r\n'
      })
    )
    refresh.mockResolvedValue(false)
    const { installPwshWithWinget } = await loadInstaller()

    await expect(installPwshWithWinget(deps)).resolves.toEqual({
      status: 'failed',
      message: 'No package found matching input criteria. (exit code 0x8A150014)'
    })
    expect(refreshDaemon).not.toHaveBeenCalled()
  })

  it('treats a non-zero exit as success when pwsh is now present (already installed)', async () => {
    run.mockResolvedValueOnce(ok).mockResolvedValueOnce(result({ code: -1978335189 }))
    refresh.mockResolvedValue(true)
    const { installPwshWithWinget } = await loadInstaller()
    await expect(installPwshWithWinget(deps)).resolves.toEqual({
      status: 'installed',
      pwshAvailable: true
    })
  })

  it('reports a timeout distinctly', async () => {
    run.mockResolvedValueOnce(ok).mockResolvedValueOnce(result({ code: null, timedOut: true }))
    refresh.mockResolvedValue(false)
    const { installPwshWithWinget } = await loadInstaller()
    await expect(installPwshWithWinget(deps)).resolves.toEqual({ status: 'timed-out' })
  })

  it('cancels the running install and shares one run between concurrent callers', async () => {
    let installSignal: AbortSignal | undefined
    run.mockResolvedValueOnce(ok).mockImplementationOnce(
      ({ signal }: { signal: AbortSignal }) =>
        new Promise<ProcessResult>((resolve) => {
          installSignal = signal
          signal.addEventListener('abort', () => resolve(result({ code: null, signal: 'SIGTERM' })))
        })
    )
    const { installPwshWithWinget, cancelPwshInstall } = await loadInstaller()

    const first = installPwshWithWinget(deps)
    const second = installPwshWithWinget(deps)
    expect(second).toBe(first)
    await vi.waitFor(() => expect(installSignal).toBeDefined())
    cancelPwshInstall()

    await expect(first).resolves.toEqual({ status: 'cancelled' })
    expect(refresh).not.toHaveBeenCalled()
    expect(run).toHaveBeenCalledTimes(2)
  })
})
