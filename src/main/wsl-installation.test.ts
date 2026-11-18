import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as childProcess from 'node:child_process'
import type { ProcessResult, ProcessSpec } from '../shared/child-process/process-spec'
import type * as RunProcess from '../shared/child-process/run-process'

const { execFileMock, execFileSyncMock, runProcessMock, registryKeys } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
  execFileSyncMock: vi.fn(),
  runProcessMock: vi.fn(),
  registryKeys: new Set<string>()
}))

vi.mock('child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof childProcess>()),
  execFile: execFileMock,
  execFileSync: execFileSyncMock
}))

vi.mock('../shared/child-process/run-process', async (importOriginal) => ({
  ...(await importOriginal<typeof RunProcess>()),
  runProcess: runProcessMock
}))

// Hermetic on a Windows host with WSL: a real service key would answer before the mocked sc.exe.
vi.mock('./windows-native-registry', () => ({
  loadWindowsNativeRegistry: () => ({
    HK: { CU: 1, LM: 2 },
    getRegistryKey: (_root: number, path: string) => (registryKeys.has(path) ? {} : null)
  })
}))

vi.mock('./wsl-interop-spawn-directory', () => ({
  resolveWslInteropSpawnCwd: () => 'C:\\Windows'
}))

import {
  _resetWslCachesForTests,
  getWslHome,
  isWslAvailableAsync,
  listRunningWslDistrosAsync,
  listWslDistros,
  listWslDistrosAsync
} from './wsl'
import {
  _resetWslInstallationForTests,
  peekWslInstallation,
  readWslInstallation
} from './wsl-installation'
import { isWslNotInstalledLatched } from '../shared/child-process/wsl-not-installed-latch'

function exited(code: number | null = 0): ProcessResult {
  return { code, signal: null, stdout: '', stderr: '', timedOut: false }
}

function answerServices(codes: Record<string, number | null>): ProcessSpec[] {
  const calls: ProcessSpec[] = []
  runProcessMock.mockImplementation(async (spec: ProcessSpec) => {
    calls.push(spec)
    const code = codes[spec.args?.[1] ?? '']
    return code === undefined ? exited(1060) : { ...exited(code), timedOut: code === null }
  })
  return calls
}

/** execFile answers wsl.exe with `stdout`; the returned array counts every wsl.exe spawn. */
function answerWslExe(stdout: string): unknown[] {
  const calls: unknown[] = []
  execFileMock.mockImplementation((...args: unknown[]) => {
    calls.push(args)
    const callback = args.at(-1)
    if (typeof callback === 'function') {
      callback(null, stdout)
    }
  })
  execFileSyncMock.mockImplementation((...args: unknown[]) => {
    calls.push(args)
    return stdout
  })
  return calls
}

describe('WSL installation verdict', () => {
  const originalPlatform = process.platform

  beforeEach(() => {
    Object.defineProperty(process, 'platform', { configurable: true, value: 'win32' })
    _resetWslCachesForTests()
    // Undo the reset's "installed host" seed: these cases are about the verdict itself.
    _resetWslInstallationForTests()
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', { configurable: true, value: originalPlatform })
    execFileMock.mockReset()
    execFileSyncMock.mockReset()
    runProcessMock.mockReset()
    registryKeys.clear()
    _resetWslCachesForTests()
    vi.useRealTimers()
  })

  it('never spawns wsl.exe on a host whose WSL services are missing', async () => {
    vi.useFakeTimers()
    const services = answerServices({})
    const wslExe = answerWslExe('')

    await expect(listWslDistrosAsync()).resolves.toEqual([])
    await expect(listRunningWslDistrosAsync()).resolves.toEqual([])
    await expect(isWslAvailableAsync()).resolves.toBe(false)
    await vi.advanceTimersByTimeAsync(30 * 60_000)
    await expect(listWslDistrosAsync()).resolves.toEqual([])
    await expect(listRunningWslDistrosAsync()).resolves.toEqual([])
    await expect(isWslAvailableAsync()).resolves.toBe(false)
    expect(listWslDistros()).toEqual([])
    expect(getWslHome('Ubuntu')).toBeNull()

    expect(wslExe).toEqual([])
    expect(services.length).toBe(2)
    expect(isWslNotInstalledLatched()).toBe(true)
  })

  it('a first sync read before the verdict spawns nothing, sync or async', async () => {
    answerServices({})
    const wslExe = answerWslExe('Ubuntu\n')

    expect(listWslDistros()).toEqual([])
    expect(getWslHome('Ubuntu')).toBeNull()
    await vi.waitFor(() => expect(isWslNotInstalledLatched()).toBe(true))
    expect(listWslDistros()).toEqual([])
    expect(wslExe).toEqual([])
  })

  it.each([
    ['access denied', exited(5)],
    ['a timeout', { ...exited(null), timedOut: true }],
    ['a signal kill', { ...exited(null), signal: 'SIGTERM' as const }]
  ])('treats %s from sc.exe as unknown and keeps probing wsl.exe', async (_label, failed) => {
    runProcessMock.mockResolvedValue(failed)
    const wslExe = answerWslExe('Ubuntu\n')

    await expect(readWslInstallation()).resolves.toBe('unknown')
    await expect(listWslDistrosAsync()).resolves.toEqual(['Ubuntu'])
    expect(isWslNotInstalledLatched()).toBe(false)
    expect(wslExe.length).toBe(1)
  })

  it.each([
    ['WSLService', { WSLService: 0, LxssManager: 1060 }],
    ['LxssManager', { WSLService: 1060, LxssManager: 0 }]
  ])('reports present when only %s is registered', async (_name, codes) => {
    answerServices(codes)
    await expect(readWslInstallation()).resolves.toBe('present')
    expect(isWslNotInstalledLatched()).toBe(false)
  })

  it('reports unknown when one service is missing and the other query times out', async () => {
    answerServices({ WSLService: 1060, LxssManager: null })
    await expect(readWslInstallation()).resolves.toBe('unknown')
    expect(isWslNotInstalledLatched()).toBe(false)
  })

  it('reuses an unknown answer briefly, then asks sc.exe again', async () => {
    vi.useFakeTimers()
    const calls = answerServices({ WSLService: 5, LxssManager: 5 })
    await expect(readWslInstallation()).resolves.toBe('unknown')
    const first = calls.length
    expect(first).toBeGreaterThan(0)
    await expect(readWslInstallation()).resolves.toBe('unknown')
    expect(calls.length).toBe(first)
    await vi.advanceTimersByTimeAsync(60_001)
    expect(peekWslInstallation()).toBe('unknown')
    await expect(readWslInstallation()).resolves.toBe('unknown')
    expect(calls.length).toBe(first * 2)
  })

  it('trusts a registered service key without spawning sc.exe', async () => {
    registryKeys.add('SYSTEM\\CurrentControlSet\\Services\\LxssManager')
    const wslExe = answerWslExe('Ubuntu\n')

    expect(listWslDistros()).toEqual(['Ubuntu'])
    await expect(readWslInstallation()).resolves.toBe('present')
    expect(runProcessMock).not.toHaveBeenCalled()
    expect(wslExe.length).toBe(1)
  })
})
