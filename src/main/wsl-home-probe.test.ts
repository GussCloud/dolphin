import { afterEach, describe, expect, it, vi } from 'vitest'
import { runWslProcess, type WslResult } from './wsl/wsl-runner'
import { _resetWslHomeProbesForTests, getWslHomeAsync, readWslHomeSync } from './wsl-home-probe'

vi.mock('./wsl/wsl-runner', () => ({ runWslProcess: vi.fn() }))

const UBUNTU_HOME = '\\\\wsl.localhost\\Ubuntu\\home\\me'

function exited(stdout: string, code: number | null = 0): WslResult {
  return { environmentResolved: true, code, stdout, stderr: '', timedOut: code === null }
}

/** Lets an off-thread re-probe kicked by a sync read settle into the cache. */
async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 10; index += 1) {
    await Promise.resolve()
  }
}

describe('WSL home probe', () => {
  afterEach(() => {
    vi.resetAllMocks()
    vi.useRealTimers()
    _resetWslHomeProbesForTests()
  })

  it('bounds cached homes while retaining the most recently used distros', () => {
    const probeSync = vi.fn()
    const read = (distro: string): string | null =>
      readWslHomeSync(distro, () => probeSync(distro) ?? `/home/${distro}\n`)

    for (let index = 0; index < 68; index += 1) {
      expect(read(`Distro-${index}`)).toContain(`Distro-${index}`)
    }
    expect(read('Distro-4')).toContain('Distro-4')
    expect(probeSync).toHaveBeenCalledTimes(68)
    expect(read('Distro-0')).toContain('Distro-0')
    expect(probeSync).toHaveBeenCalledTimes(69)
  })

  it('asks the runner for $HOME without a login shell or PATH probe', async () => {
    vi.mocked(runWslProcess).mockResolvedValue(exited('/home/me\n'))

    await expect(getWslHomeAsync('Ubuntu')).resolves.toBe(UBUNTU_HOME)
    expect(runWslProcess).toHaveBeenCalledWith({
      distro: 'Ubuntu',
      program: 'bash',
      args: ['-c', 'echo $HOME'],
      loginPath: 'none',
      timeoutMs: 5000
    })
  })

  // Why: allowed-roots resolves this twice per filesystem IPC, so a stopped or broken
  // distro must not block the main thread for 5s on every call.
  it.each([
    ['empty output', () => ''],
    ['non-path output', () => 'not-a-path\n'],
    [
      'a probe that throws',
      () => {
        throw new Error('spawnSync wsl.exe ETIMEDOUT')
      }
    ]
  ])('answers sync reads at once after %s and heals off-thread', async (_label, failing) => {
    vi.useFakeTimers()
    const probeSync = vi.fn(failing)
    vi.mocked(runWslProcess).mockResolvedValue(exited('/home/me\n'))

    expect(readWslHomeSync('Ubuntu', probeSync)).toBeNull()
    expect(readWslHomeSync('Ubuntu', probeSync)).toBeNull()
    expect(probeSync).toHaveBeenCalledTimes(1)
    expect(runWslProcess).not.toHaveBeenCalled()

    vi.advanceTimersByTime(15_000)
    expect(readWslHomeSync('Ubuntu', probeSync)).toBeNull()
    await flushMicrotasks()
    expect(runWslProcess).toHaveBeenCalledTimes(1)
    expect(readWslHomeSync('Ubuntu', probeSync)).toBe(UBUNTU_HOME)
    expect(probeSync).toHaveBeenCalledTimes(1)
  })

  it('backs off the off-thread re-probe while the distro keeps failing', async () => {
    vi.useFakeTimers()
    const probeSync = vi.fn(() => '')
    vi.mocked(runWslProcess).mockRejectedValue(new Error('distro is not running'))

    expect(readWslHomeSync('Ubuntu', probeSync)).toBeNull()
    vi.advanceTimersByTime(15_000)
    readWslHomeSync('Ubuntu', probeSync)
    readWslHomeSync('Ubuntu', probeSync)
    await flushMicrotasks()
    expect(runWslProcess).toHaveBeenCalledTimes(1)
    // Second failure doubles the window, so another 15s is not enough.
    vi.advanceTimersByTime(15_000)
    readWslHomeSync('Ubuntu', probeSync)
    await flushMicrotasks()
    expect(runWslProcess).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(15_000)
    readWslHomeSync('Ubuntu', probeSync)
    await flushMicrotasks()
    expect(runWslProcess).toHaveBeenCalledTimes(2)
    expect(probeSync).toHaveBeenCalledTimes(1)
  })

  // Why: placement-critical callers await the async probe, so a sync-side failure
  // window must never stop them from asking again.
  it('keeps async callers probing on every miss and shares concurrent probes', async () => {
    let finishProbe: ((result: WslResult) => void) | undefined
    vi.mocked(runWslProcess).mockImplementation(
      () =>
        new Promise((resolve) => {
          finishProbe = resolve
        })
    )

    expect(readWslHomeSync('Ubuntu', () => '')).toBeNull()
    const first = getWslHomeAsync('Ubuntu')
    const second = getWslHomeAsync('Ubuntu')
    expect(runWslProcess).toHaveBeenCalledTimes(1)
    finishProbe?.(exited('/home/me\n'))
    await expect(Promise.all([first, second])).resolves.toEqual([UBUNTU_HOME, UBUNTU_HOME])
    expect(readWslHomeSync('Ubuntu', () => '')).toBe(UBUNTU_HOME)
  })

  it.each([
    ['a non-zero exit', exited('/home/me\n', 1)],
    ['a timeout', exited('', null)]
  ])('never caches %s as a home', async (_label, result) => {
    vi.mocked(runWslProcess).mockResolvedValue(result)

    await expect(getWslHomeAsync('Ubuntu')).resolves.toBeNull()
    await expect(getWslHomeAsync('Ubuntu')).resolves.toBeNull()
    expect(runWslProcess).toHaveBeenCalledTimes(2)
  })
})
