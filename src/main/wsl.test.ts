import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as childProcess from 'node:child_process'

const { execFileMock, execFileSyncMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
  execFileSyncMock: vi.fn()
}))

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof childProcess>()
  return {
    ...actual,
    execFile: execFileMock,
    execFileSync: execFileSyncMock
  }
})

import {
  _resetWslCachesForTests,
  _setWslCachesForTests,
  getCachedWslAvailability,
  getCachedWslDistros,
  getWslHome,
  hasCachedWslAvailability,
  hasCachedWslDistros,
  isWslAvailableAsync,
  listWslDistros,
  listWslDistrosAsync,
  parseWslPath,
  toLinuxPath,
  toWindowsWslPath,
  wslUncDirectoryExists,
  wslUncDirectoryExistsAsync
} from './wsl'

function withPlatform<T>(value: NodeJS.Platform, fn: () => T): T {
  const original = process.platform
  Object.defineProperty(process, 'platform', { configurable: true, value })
  try {
    return fn()
  } finally {
    Object.defineProperty(process, 'platform', { configurable: true, value: original })
  }
}

/** Lets an off-thread refresh kicked by a sync read settle into the cache. */
async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 10; index += 1) {
    await Promise.resolve()
  }
}

function answerAsyncProbesWith(stdout: string | Error): void {
  execFileMock.mockImplementation((_command, _args, _options, callback) => {
    if (stdout instanceof Error) {
      callback(stdout, '')
    } else {
      callback(null, stdout)
    }
  })
}

async function withPlatformAsync<T>(value: NodeJS.Platform, fn: () => Promise<T>): Promise<T> {
  const original = process.platform
  Object.defineProperty(process, 'platform', { configurable: true, value })
  try {
    return await fn()
  } finally {
    Object.defineProperty(process, 'platform', { configurable: true, value: original })
  }
}

describe('WSL distro discovery cache', () => {
  afterEach(() => {
    execFileMock.mockReset()
    execFileSyncMock.mockReset()
    _resetWslCachesForTests()
  })

  it('retries asynchronous discovery after a transient wsl.exe failure', async () => {
    vi.useFakeTimers()
    execFileMock
      .mockImplementationOnce((_command, _args, _options, callback) => {
        callback(new Error('transient failure'), '')
      })
      .mockImplementationOnce((_command, _args, _options, callback) => {
        callback(null, 'Ubuntu\n')
      })

    try {
      await withPlatformAsync('win32', async () => {
        await expect(listWslDistrosAsync()).resolves.toEqual([])
        expect(getCachedWslDistros()).toBeNull()
        // Brief negative caching bounds the wsl.exe spawn rate between retries.
        await expect(listWslDistrosAsync()).resolves.toEqual([])
        expect(execFileMock).toHaveBeenCalledTimes(1)
        vi.advanceTimersByTime(15_000)
        await expect(listWslDistrosAsync()).resolves.toEqual(['Ubuntu'])
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('retries synchronous discovery off-thread after a transient wsl.exe failure', async () => {
    vi.useFakeTimers()
    execFileSyncMock.mockImplementationOnce(() => {
      throw new Error('transient failure')
    })
    answerAsyncProbesWith('Ubuntu\n')

    try {
      await withPlatformAsync('win32', async () => {
        expect(listWslDistros()).toEqual([])
        expect(getCachedWslDistros()).toBeNull()
        expect(listWslDistros()).toEqual([])
        expect(execFileSyncMock).toHaveBeenCalledTimes(1)
        vi.advanceTimersByTime(15_000)
        expect(listWslDistros()).toEqual([])
        await flushMicrotasks()
        expect(listWslDistros()).toEqual(['Ubuntu'])
        expect(execFileSyncMock).toHaveBeenCalledTimes(1)
      })
    } finally {
      vi.useRealTimers()
    }
  })

  // Why: `wsl --install` succeeds and reports zero distros while the distro is
  // still being provisioned (or until the required reboot). Caching that empty
  // success for the process lifetime is why users saw WSL offered during setup
  // and then permanently absent from the terminal picker.
  it('retries asynchronous discovery after wsl.exe reports no distros yet', async () => {
    vi.useFakeTimers()
    execFileMock
      .mockImplementationOnce((_command, _args, _options, callback) => {
        callback(null, '')
      })
      .mockImplementationOnce((_command, _args, _options, callback) => {
        callback(null, 'Ubuntu\n')
      })

    try {
      await withPlatformAsync('win32', async () => {
        await expect(listWslDistrosAsync()).resolves.toEqual([])
        vi.advanceTimersByTime(15_000)
        await expect(listWslDistrosAsync()).resolves.toEqual(['Ubuntu'])
      })
    } finally {
      vi.useRealTimers()
    }
  })

  // Why: only the cold read may block the main thread; later refreshes run off-thread.
  it('refreshes synchronous discovery off-thread after wsl.exe reports no distros yet', async () => {
    vi.useFakeTimers()
    execFileSyncMock.mockReturnValueOnce('')
    answerAsyncProbesWith('Ubuntu\n')

    try {
      await withPlatformAsync('win32', async () => {
        expect(listWslDistros()).toEqual([])
        vi.advanceTimersByTime(15_000)
        expect(listWslDistros()).toEqual([])
        await flushMicrotasks()
        expect(listWslDistros()).toEqual(['Ubuntu'])
        expect(execFileSyncMock).toHaveBeenCalledTimes(1)
        expect(execFileMock).toHaveBeenCalledTimes(1)
      })
    } finally {
      vi.useRealTimers()
    }
  })

  // Why: an empty result must still not let every caller re-spawn a blocking
  // wsl.exe; it reuses the same brief negative-cache window as a hard failure.
  it('bounds the wsl.exe spawn rate while no distros are installed', () => {
    execFileSyncMock.mockReturnValue('')

    withPlatform('win32', () => {
      expect(listWslDistros()).toEqual([])
      expect(listWslDistros()).toEqual([])
      expect(execFileSyncMock).toHaveBeenCalledTimes(1)
    })
  })

  it('bounds the asynchronous spawn rate while no distros are installed', async () => {
    execFileMock.mockImplementation((_command, _args, _options, callback) => {
      callback(null, '')
    })

    await withPlatformAsync('win32', async () => {
      await expect(listWslDistrosAsync()).resolves.toEqual([])
      await expect(listWslDistrosAsync()).resolves.toEqual([])
      expect(execFileMock).toHaveBeenCalledTimes(1)
    })
  })

  it('still caches a non-empty distro list for the process lifetime', () => {
    execFileSyncMock.mockReturnValueOnce('Ubuntu\n')

    withPlatform('win32', () => {
      expect(listWslDistros()).toEqual(['Ubuntu'])
      expect(listWslDistros()).toEqual(['Ubuntu'])
      expect(execFileSyncMock).toHaveBeenCalledTimes(1)
    })
  })

  // Why: docker-desktop entries filter to zero user distros, which is the same
  // "nothing installed yet" state as an empty list — a distro installed later
  // must still appear. The answer stays readable as [] so a missing distro is
  // still visible to `isKnownMissingDistro`.
  it('re-probes a docker-desktop-only machine once a user distro can appear', async () => {
    vi.useFakeTimers()
    execFileSyncMock.mockReturnValueOnce('docker-desktop\ndocker-desktop-data\n')
    answerAsyncProbesWith('docker-desktop\nUbuntu\n')

    try {
      await withPlatformAsync('win32', async () => {
        expect(listWslDistros()).toEqual([])
        expect(getCachedWslDistros()).toEqual([])
        expect(listWslDistros()).toEqual([])
        expect(execFileSyncMock).toHaveBeenCalledTimes(1)
        vi.advanceTimersByTime(15_000)
        listWslDistros()
        await flushMicrotasks()
        expect(listWslDistros()).toEqual(['Ubuntu'])
      })
    } finally {
      vi.useRealTimers()
    }
  })

  // Why: a docker-desktop-only machine filters to empty on every probe, so a flat
  // window would re-spawn wsl.exe every 15s for the whole session.
  it('backs off while the list keeps coming back empty', async () => {
    vi.useFakeTimers()
    execFileSyncMock.mockReturnValue('')
    answerAsyncProbesWith('')

    try {
      await withPlatformAsync('win32', async () => {
        expect(listWslDistros()).toEqual([])
        vi.advanceTimersByTime(15_000)
        expect(listWslDistros()).toEqual([])
        await flushMicrotasks()
        expect(execFileMock).toHaveBeenCalledTimes(1)
        // Second empty result doubles the window, so 15s more is not enough.
        vi.advanceTimersByTime(15_000)
        expect(listWslDistros()).toEqual([])
        await flushMicrotasks()
        expect(execFileMock).toHaveBeenCalledTimes(1)
        vi.advanceTimersByTime(15_000)
        expect(listWslDistros()).toEqual([])
        await flushMicrotasks()
        expect(execFileMock).toHaveBeenCalledTimes(2)
        expect(execFileSyncMock).toHaveBeenCalledTimes(1)
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('backs off after repeated distro-list failures', async () => {
    vi.useFakeTimers()
    execFileSyncMock.mockImplementation(() => {
      throw new Error('transient failure')
    })
    answerAsyncProbesWith(new Error('transient failure'))

    try {
      await withPlatformAsync('win32', async () => {
        expect(listWslDistros()).toEqual([])
        vi.advanceTimersByTime(15_000)
        expect(listWslDistros()).toEqual([])
        await flushMicrotasks()
        expect(execFileMock).toHaveBeenCalledTimes(1)
        vi.advanceTimersByTime(15_000)
        expect(listWslDistros()).toEqual([])
        await flushMicrotasks()
        expect(execFileMock).toHaveBeenCalledTimes(1)
        // A failed cold probe still never blocks the main thread twice.
        expect(execFileSyncMock).toHaveBeenCalledTimes(1)
      })
    } finally {
      vi.useRealTimers()
    }
  })

  // Why: the cap is the only bound on how long a distro installed mid-session stays
  // invisible, so pin it rather than letting the doubling run away.
  it('caps the empty-list backoff at five minutes', async () => {
    vi.useFakeTimers()
    execFileSyncMock.mockReturnValue('')
    answerAsyncProbesWith('')
    const probeCount = (): number =>
      execFileSyncMock.mock.calls.length + execFileMock.mock.calls.length

    try {
      await withPlatformAsync('win32', async () => {
        // Windows double to 15/30/60/120/240s, so the 6th would be 480s uncapped.
        for (const delayMs of [0, 15_000, 30_000, 60_000, 120_000, 240_000]) {
          vi.advanceTimersByTime(delayMs)
          listWslDistros()
          await flushMicrotasks()
        }
        expect(probeCount()).toBe(6)
        vi.advanceTimersByTime(300_000)
        listWslDistros()
        await flushMicrotasks()
        expect(probeCount()).toBe(7)
      })
    } finally {
      vi.useRealTimers()
    }
  })

  // Why: an empty list is a real probe result and must keep driving the
  // `wsl-distro-missing` repair prompt even once stale. Going null instead fails
  // open and silently spawns `wsl.exe -d <distro>` for a distro Dolphin saw was absent.
  it('keeps reporting an empty result after it goes stale', () => {
    vi.useFakeTimers()
    execFileSyncMock.mockReturnValue('')

    try {
      withPlatform('win32', () => {
        expect(listWslDistros()).toEqual([])
        expect(getCachedWslDistros()).toEqual([])
        vi.advanceTimersByTime(15_000)
        expect(getCachedWslDistros()).toEqual([])
        expect(hasCachedWslDistros()).toBe(true)
      })
    } finally {
      vi.useRealTimers()
    }
  })

  // Why: a genuinely missing distro yields a non-empty list, which never expires,
  // so repair-required still fires for the case that warrants it.
  it('keeps reporting a known distro list indefinitely', () => {
    vi.useFakeTimers()
    execFileSyncMock.mockReturnValueOnce('Ubuntu\n')

    try {
      withPlatform('win32', () => {
        expect(listWslDistros()).toEqual(['Ubuntu'])
        vi.advanceTimersByTime(600_000)
        expect(getCachedWslDistros()).toEqual(['Ubuntu'])
      })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('WSL home sync probe', () => {
  afterEach(() => {
    execFileSyncMock.mockReset()
    _resetWslCachesForTests()
  })

  it('probes a cold distro once with --exec, then serves the cache', () => {
    execFileSyncMock.mockReturnValue('/home/me\n')

    withPlatform('win32', () => {
      expect(getWslHome('Ubuntu')).toBe('\\\\wsl.localhost\\Ubuntu\\home\\me')
      expect(getWslHome('Ubuntu')).toBe('\\\\wsl.localhost\\Ubuntu\\home\\me')
    })
    expect(execFileSyncMock).toHaveBeenCalledTimes(1)
    expect(execFileSyncMock).toHaveBeenCalledWith(
      'wsl.exe',
      ['-d', 'Ubuntu', '--exec', 'bash', '-c', 'echo $HOME'],
      expect.objectContaining({ timeout: 5000, cwd: expect.any(String) })
    )
  })
})

describe('WSL availability cache', () => {
  afterEach(() => {
    execFileMock.mockReset()
    execFileSyncMock.mockReset()
    _resetWslCachesForTests()
  })

  // Real execFile timeout shape on Windows: killed, no exit code, SIGTERM.
  const timeoutError = (): Error =>
    Object.assign(new Error('Command failed: wsl.exe --status'), {
      killed: true,
      code: null,
      signal: 'SIGTERM'
    })

  /** Each `--status` probe settles with the next outcome; null is success. */
  function queueStatusOutcomes(...outcomes: (Error | null)[]): void {
    for (const outcome of outcomes) {
      execFileMock.mockImplementationOnce((_command, _args, _options, callback) => {
        callback(outcome, '', '')
      })
    }
  }

  // Why: a cold WSL2 utility-VM boot on a just-installed or just-rebooted
  // machine routinely exceeds the 5s probe timeout. Latching false for the
  // process lifetime is what makes WSL vanish from the picker after setup.
  it('retries availability after a probe timeout instead of latching false', async () => {
    vi.useFakeTimers()
    queueStatusOutcomes(timeoutError(), null)

    try {
      await withPlatformAsync('win32', async () => {
        await expect(isWslAvailableAsync()).resolves.toBe(false)
        vi.advanceTimersByTime(45_000)
        await expect(isWslAvailableAsync()).resolves.toBe(true)
      })
    } finally {
      vi.useRealTimers()
    }
  })

  // Why: a timeout must not let every caller re-spawn the probe immediately.
  it('bounds the probe rate while the failure window is open', async () => {
    queueStatusOutcomes(timeoutError())

    await withPlatformAsync('win32', async () => {
      await expect(isWslAvailableAsync()).resolves.toBe(false)
      await expect(isWslAvailableAsync()).resolves.toBe(false)
      expect(execFileMock).toHaveBeenCalledTimes(1)
    })
  })

  it('caches a successful probe for the process lifetime', async () => {
    queueStatusOutcomes(null)

    await withPlatformAsync('win32', async () => {
      await expect(isWslAvailableAsync()).resolves.toBe(true)
      await expect(isWslAvailableAsync()).resolves.toBe(true)
      expect(execFileMock).toHaveBeenCalledTimes(1)
    })
  })

  // Why: the renderer's capability read reaches this over IPC; a blocking spawn there
  // stalls every PTY message and window IPC for as long as wsl.exe takes to answer.
  it('probes availability without blocking the main thread', async () => {
    queueStatusOutcomes(null)

    await withPlatformAsync('win32', async () => {
      await expect(isWslAvailableAsync()).resolves.toBe(true)
      expect(execFileMock).toHaveBeenCalledWith(
        'wsl.exe',
        ['--status'],
        expect.objectContaining({ timeout: 5000, windowsHide: true }),
        expect.any(Function)
      )
      expect(execFileSyncMock).not.toHaveBeenCalled()
    })
  })

  // Why this site matters more than the other wsl.exe spawns (#16463): ENOENT is
  // deliberately non-retryable here, so a spawn that failed only because the
  // inherited cwd had been deleted was cached as "WSL is not installed" on the
  // 10-minute definitive TTL with exponential backoff. Git kept working and Dolphin
  // reported WSL unavailable -- a worse state than the bug being fixed. Naming
  // the directory is what keeps ENOENT meaning "wsl.exe is not on PATH".
  it('names an explicit spawn directory, so no deleted cwd can read as ENOENT', async () => {
    queueStatusOutcomes(null)

    await withPlatformAsync('win32', async () => {
      await expect(isWslAvailableAsync()).resolves.toBe(true)
    })
    expect(execFileMock).toHaveBeenCalledWith(
      'wsl.exe',
      ['--status'],
      expect.objectContaining({ cwd: expect.any(String) }),
      expect.any(Function)
    )
  })

  it('shares one wsl.exe spawn between concurrent async probes', async () => {
    execFileMock.mockImplementation((_command, _args, _options, callback) => {
      setTimeout(() => callback(null, '', ''), 0)
    })

    await withPlatformAsync('win32', async () => {
      const results = await Promise.all([isWslAvailableAsync(), isWslAvailableAsync()])
      expect(results).toEqual([true, true])
      expect(execFileMock).toHaveBeenCalledTimes(1)
    })
  })

  it('does not restore a failure after distro discovery disproves it mid-probe', async () => {
    const callbacks = new Map<string, (error: Error | null, stdout: string) => void>()
    execFileMock.mockImplementation((_command, args, _options, callback) => {
      callbacks.set(args.join(' '), callback)
    })

    await withPlatformAsync('win32', async () => {
      const staleAvailability = isWslAvailableAsync()
      const distroProbe = listWslDistrosAsync()
      callbacks.get('--list --quiet')?.(null, 'Ubuntu\n')
      await expect(distroProbe).resolves.toEqual(['Ubuntu'])

      callbacks.get('--status')?.(Object.assign(new Error('older failure'), { code: 1 }), '')
      await expect(staleAvailability).resolves.toBe(false)
      expect(getCachedWslAvailability()).toBeNull()

      const retry = isWslAvailableAsync()
      callbacks.get('--status')?.(null, '')
      await expect(retry).resolves.toBe(true)
    })
  })

  // Why: the resolver reads the cached getter, not the probe. Reporting the last
  // observed answer keeps the `wsl-unavailable` repair prompt reachable; going null
  // on staleness would let git and PTY silently resolve to a WSL that just failed.
  it('keeps reporting the last observed answer after it goes stale', async () => {
    vi.useFakeTimers()
    queueStatusOutcomes(timeoutError())

    try {
      await withPlatformAsync('win32', async () => {
        await expect(isWslAvailableAsync()).resolves.toBe(false)
        vi.advanceTimersByTime(45_000)
        expect(getCachedWslAvailability()).toBe(false)
        expect(hasCachedWslAvailability()).toBe(true)
      })
    } finally {
      vi.useRealTimers()
    }
  })

  // Why: an answer-shaped failure earns a long window, not a session-long latch —
  // wsl.exe also exits non-zero while the WSL package is servicing or LxssManager is
  // still starting, which is transient. wsl.exe ships in System32 on every modern
  // Windows, so a host without WSL answers with a non-zero exit, not ENOENT.
  it.each([
    ['wsl.exe reports WSL unusable', { code: 1 }],
    ['wsl.exe is not installed', { code: 'ENOENT' }]
  ])('holds a definitive failure far longer than a timeout when %s', async (_label, fields) => {
    vi.useFakeTimers()
    queueStatusOutcomes(Object.assign(new Error('definitive failure'), fields), null)

    try {
      await withPlatformAsync('win32', async () => {
        await expect(isWslAvailableAsync()).resolves.toBe(false)
        vi.advanceTimersByTime(45_000)
        await expect(isWslAvailableAsync()).resolves.toBe(false)
        expect(getCachedWslAvailability()).toBe(false)
        expect(execFileMock).toHaveBeenCalledTimes(1)
        vi.advanceTimersByTime(10 * 60_000)
        await expect(isWslAvailableAsync()).resolves.toBe(true)
      })
    } finally {
      vi.useRealTimers()
    }
  })

  // Why: a wedged wsl.exe must not be re-probed on every window boundary for the
  // rest of the session.
  it('backs off after repeated probe failures', async () => {
    vi.useFakeTimers()
    execFileMock.mockImplementation((_command, _args, _options, callback) => {
      callback(timeoutError(), '', '')
    })

    try {
      await withPlatformAsync('win32', async () => {
        await expect(isWslAvailableAsync()).resolves.toBe(false)
        vi.advanceTimersByTime(45_000)
        await expect(isWslAvailableAsync()).resolves.toBe(false)
        expect(execFileMock).toHaveBeenCalledTimes(2)
        // Second failure doubles the window, so the next boundary is not enough.
        vi.advanceTimersByTime(45_000)
        await expect(isWslAvailableAsync()).resolves.toBe(false)
        expect(execFileMock).toHaveBeenCalledTimes(2)
      })
    } finally {
      vi.useRealTimers()
    }
  })

  // Why: a seeded retryable failure must re-probe once its window lapses, the same
  // as one observed live — otherwise test setup can hide the latch this fixes.
  it('re-probes a seeded retryable failure once its window lapses', async () => {
    vi.useFakeTimers()
    queueStatusOutcomes(null)

    try {
      await withPlatformAsync('win32', async () => {
        _setWslCachesForTests({ available: false, availabilityRetryable: true })
        await expect(isWslAvailableAsync()).resolves.toBe(false)
        vi.advanceTimersByTime(45_000)
        await expect(isWslAvailableAsync()).resolves.toBe(true)
      })
    } finally {
      vi.useRealTimers()
    }
  })

  // Why: the caches expire independently and `getWslRepairReason` checks availability
  // first, so a definitive failure held for 10min would report `wsl-unavailable` over a
  // WSL that just listed a distro. Finding a distro must drop the stale failure.
  it.each([
    ['a definitive failure', { code: 1 }],
    ['a timeout', { killed: true, code: null, signal: 'SIGTERM' }]
  ])('re-probes availability once a distro list succeeds after %s', async (_label, fields) => {
    queueStatusOutcomes(Object.assign(new Error('probe failed'), fields))

    await withPlatformAsync('win32', async () => {
      await expect(isWslAvailableAsync()).resolves.toBe(false)

      // A distro turns up (WSL finished provisioning / was repaired mid-session).
      execFileSyncMock.mockReturnValueOnce('Ubuntu\n')
      expect(listWslDistros()).toEqual(['Ubuntu'])

      // Without dropping the stale failure this would stay false for 10min.
      queueStatusOutcomes(null)
      await expect(isWslAvailableAsync()).resolves.toBe(true)
    })
  })

  // Why: an empty list re-probes on a 15s-to-5min schedule, so clearing the availability
  // failure on every empty probe would re-spawn the probe far too often.
  it('does not drop an availability failure for an empty distro list', async () => {
    queueStatusOutcomes(Object.assign(new Error('probe failed'), { code: 1 }))

    await withPlatformAsync('win32', async () => {
      await expect(isWslAvailableAsync()).resolves.toBe(false)
      execFileSyncMock.mockReturnValueOnce('')
      expect(listWslDistros()).toEqual([])
      expect(getCachedWslAvailability()).toBe(false)
      // Still inside the definitive window, so no re-probe was paid.
      await expect(isWslAvailableAsync()).resolves.toBe(false)
      expect(execFileMock).toHaveBeenCalledTimes(1)
    })
  })

  it('keeps reporting unavailable off Windows without probing', async () => {
    await withPlatformAsync('darwin', async () => {
      await expect(isWslAvailableAsync()).resolves.toBe(false)
      expect(getCachedWslAvailability()).toBe(false)
      expect(execFileMock).not.toHaveBeenCalled()
    })
  })
})

describe('wsl path helpers', () => {
  it('parses WSL UNC paths on Windows', () => {
    const originalPlatform = process.platform
    Object.defineProperty(process, 'platform', {
      configurable: true,
      value: 'win32'
    })

    try {
      expect(parseWslPath('\\\\wsl.localhost\\Ubuntu\\home\\jin\\repo')).toEqual({
        distro: 'Ubuntu',
        linuxPath: '/home/jin/repo'
      })
    } finally {
      Object.defineProperty(process, 'platform', {
        configurable: true,
        value: originalPlatform
      })
    }
  })

  it('converts Windows drive paths to /mnt paths for WSL commands', () => {
    expect(toLinuxPath('C:\\Users\\jinwo\\git\\dolphin')).toBe('/mnt/c/Users/jinwo/git/dolphin')
  })

  it('converts /mnt drive paths back to native Windows form', () => {
    expect(toWindowsWslPath('/mnt/c/Users/jinwo/git/dolphin', 'Ubuntu')).toBe(
      'C:\\Users\\jinwo\\git\\dolphin'
    )
  })
})

describe('wslUncDirectoryExists', () => {
  afterEach(() => {
    execFileSyncMock.mockReset()
  })

  it('returns true when the distro reports the directory exists', () => {
    execFileSyncMock.mockReturnValue('__DOLPHIN_DIRECTORY_EXISTS__')
    const result = withPlatform('win32', () =>
      wslUncDirectoryExists('\\\\wsl.localhost\\Ubuntu\\home\\jin\\repo')
    )
    expect(result).toBe(true)
    expect(execFileSyncMock).toHaveBeenCalledWith(
      'wsl.exe',
      [
        '-d',
        'Ubuntu',
        '--exec',
        'sh',
        '-c',
        expect.stringContaining('__DOLPHIN_DIRECTORY_EXISTS__'),
        'sh',
        '/home/jin/repo'
      ],
      expect.objectContaining({ timeout: 5000 })
    )
  })

  it('returns false when the guest reports the directory missing', () => {
    execFileSyncMock.mockReturnValue('__DOLPHIN_DIRECTORY_MISSING__')
    const result = withPlatform('win32', () =>
      wslUncDirectoryExists('\\\\wsl.localhost\\Ubuntu\\home\\jin\\missing')
    )
    expect(result).toBe(false)
  })

  it('returns null when wsl.exe or the distro is unavailable', () => {
    execFileSyncMock.mockImplementation(() => {
      const error = new Error('distro unavailable') as Error & { status: number }
      error.status = 4294967295
      throw error
    })
    const result = withPlatform('win32', () =>
      wslUncDirectoryExists('\\\\wsl.localhost\\Ubuntu\\home\\jin\\repo')
    )
    expect(result).toBeNull()
  })

  it('returns null for non-WSL paths and off Windows', () => {
    expect(withPlatform('win32', () => wslUncDirectoryExists('C:\\Users\\jin\\repo'))).toBeNull()
    expect(
      withPlatform('linux', () => wslUncDirectoryExists('\\\\wsl.localhost\\Ubuntu\\home\\jin'))
    ).toBeNull()
    expect(execFileSyncMock).not.toHaveBeenCalled()
  })
})

describe('wslUncDirectoryExistsAsync', () => {
  afterEach(() => {
    execFileMock.mockReset()
  })

  it('returns true when the distro reports the directory exists', async () => {
    execFileMock.mockImplementation((_command, _args, _options, callback) =>
      callback(null, '__DOLPHIN_DIRECTORY_EXISTS__')
    )

    await expect(
      withPlatformAsync('win32', () =>
        wslUncDirectoryExistsAsync('\\\\wsl.localhost\\Ubuntu\\home\\jin\\repo')
      )
    ).resolves.toBe(true)
    expect(execFileMock).toHaveBeenCalledWith(
      'wsl.exe',
      [
        '-d',
        'Ubuntu',
        '--exec',
        'sh',
        '-c',
        expect.stringContaining('__DOLPHIN_DIRECTORY_EXISTS__'),
        'sh',
        '/home/jin/repo'
      ],
      expect.objectContaining({ timeout: 5000 }),
      expect.any(Function)
    )
  })

  it('distinguishes a missing directory from an inconclusive probe', async () => {
    execFileMock
      .mockImplementationOnce((_command, _args, _options, callback) =>
        callback(null, '__DOLPHIN_DIRECTORY_MISSING__')
      )
      .mockImplementationOnce((_command, _args, _options, callback) =>
        callback(Object.assign(new Error('distro unavailable'), { code: 4294967295 }), '')
      )

    await withPlatformAsync('win32', async () => {
      await expect(
        wslUncDirectoryExistsAsync('\\\\wsl.localhost\\Ubuntu\\home\\jin\\missing')
      ).resolves.toBe(false)
      await expect(
        wslUncDirectoryExistsAsync('\\\\wsl.localhost\\Ubuntu\\home\\jin\\repo')
      ).resolves.toBeNull()
    })
  })

  it('returns null without spawning for paths outside WSL or off Windows', async () => {
    await expect(
      withPlatformAsync('win32', () => wslUncDirectoryExistsAsync('C:\\Users\\jin\\repo'))
    ).resolves.toBeNull()
    await expect(
      withPlatformAsync('linux', () =>
        wslUncDirectoryExistsAsync('\\\\wsl.localhost\\Ubuntu\\home\\jin')
      )
    ).resolves.toBeNull()
    expect(execFileMock).not.toHaveBeenCalled()
  })
})

describe('wsl.exe console visibility', () => {
  afterEach(() => {
    execFileMock.mockReset()
    execFileSyncMock.mockReset()
    _resetWslCachesForTests()
  })

  it('hides the console of every wsl.exe probe this module starts', async () => {
    execFileSyncMock.mockReturnValue('Ubuntu\n')
    answerAsyncProbesWith('Ubuntu\n')

    await withPlatformAsync('win32', async () => {
      wslUncDirectoryExists('\\\\wsl.localhost\\Ubuntu\\home\\jin\\repo')
      await wslUncDirectoryExistsAsync('\\\\wsl.localhost\\Ubuntu\\home\\jin\\repo')
      listWslDistros()
      getWslHome('Ubuntu')
    })

    const calls = [...execFileSyncMock.mock.calls, ...execFileMock.mock.calls]
    expect(calls.length).toBeGreaterThanOrEqual(4)
    for (const [command, , options] of calls) {
      expect(command).toBe('wsl.exe')
      expect(options).toEqual(expect.objectContaining({ windowsHide: true }))
    }
  })
})
