import { describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import {
  createCodexAuthJson,
  createRateLimits,
  createRuntimeHome,
  createSettings,
  createStore,
  registerCodexAccountsTestHomes,
  testState
} from './service-test-harness'

vi.mock('electron', () => ({
  app: {
    getPath: () => testState.userDataDir
  }
}))

vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os') // eslint-disable-line @typescript-eslint/consistent-type-imports -- vi.importActual requires inline import()
  return {
    ...actual,
    homedir: () => testState.fakeHomeDir
  }
})

function taskkillResult(code: number | null, timedOut = false) {
  return { code, signal: null, stdout: '', stderr: '', timedOut }
}

describe('CodexAccountService config sync', () => {
  registerCodexAccountsTestHomes()

  it('removes command listeners when Codex login times out', async () => {
    vi.resetModules()
    vi.useFakeTimers()
    const child = new EventEmitter() as EventEmitter & {
      stdout: PassThrough
      stderr: PassThrough
      kill: () => void
    }
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.kill = vi.fn()
    const spawnMock = vi.fn(() => child)
    vi.doMock('node:child_process', () => ({ spawn: spawnMock }))
    vi.doMock('../codex-cli/command', () => ({
      resolveCodexCommand: () => 'codex'
    }))

    try {
      const settings = createSettings()
      const store = createStore(settings)
      const rateLimits = createRateLimits()
      const runtimeHome = createRuntimeHome()
      const { CodexAccountService } = await import('./service')
      const service = new CodexAccountService(
        store as never,
        rateLimits as never,
        runtimeHome as never
      )
      const loginPromise = (
        service as unknown as {
          runCodexLogin(managedHomePath: string): Promise<void>
        }
      ).runCodexLogin(testState.fakeHomeDir)
      const rejection = expect(loginPromise).rejects.toThrow(
        'Codex sign-in took too long to finish.'
      )

      await vi.advanceTimersByTimeAsync(180_000)

      await rejection
      expect(child.kill).toHaveBeenCalledTimes(1)
      expect(child.stdout.listenerCount('data')).toBe(0)
      expect(child.stderr.listenerCount('data')).toBe(0)
      expect(child.listenerCount('error')).toBe(0)
      expect(child.listenerCount('close')).toBe(0)
    } finally {
      vi.useRealTimers()
      vi.doUnmock('node:child_process')
      vi.doUnmock('../../shared/child-process/run-process')
      vi.doUnmock('../codex-cli/command')
    }
  })

  it('force-kills a lingering Windows codex login tree once auth.json exists', async () => {
    vi.resetModules()
    vi.useFakeTimers()
    const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      configurable: true
    })
    const child = new EventEmitter() as EventEmitter & {
      stdout: PassThrough
      stderr: PassThrough
      kill: () => void
      pid: number
      exitCode: number | null
      signalCode: string | null
    }
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.kill = vi.fn()
    child.pid = 4242
    child.exitCode = null
    child.signalCode = null
    const runProcessMock = vi.fn(async () => taskkillResult(0))
    const spawnMock = vi.fn(() => child)
    vi.doMock('node:child_process', () => ({ spawn: spawnMock }))
    vi.doMock('../../shared/child-process/run-process', () => ({ runProcess: runProcessMock }))
    vi.doMock('../codex-cli/command', () => ({
      resolveCodexCommand: () => 'codex'
    }))

    try {
      const store = createStore(createSettings())
      const rateLimits = createRateLimits()
      const runtimeHome = createRuntimeHome()
      const { CodexAccountService } = await import('./service')
      const service = new CodexAccountService(
        store as never,
        rateLimits as never,
        runtimeHome as never
      )
      const loginPromise = (
        service as unknown as {
          runCodexLogin(managedHomePath: string): Promise<void>
        }
      ).runCodexLogin(testState.fakeHomeDir)

      await vi.advanceTimersByTimeAsync(1_000)
      expect(runProcessMock).not.toHaveBeenCalled()

      // Codex finishes the login (auth.json exists) but never exits on its own.
      writeFileSync(
        join(testState.fakeHomeDir, 'auth.json'),
        createCodexAuthJson('user@example.com', 'provider-account-1', 'refresh-token'),
        'utf-8'
      )
      await vi.advanceTimersByTimeAsync(6_000)
      expect(runProcessMock).toHaveBeenCalledWith(
        expect.objectContaining({
          program: 'taskkill.exe',
          args: ['/pid', '4242', '/t', '/f'],
          stdio: 'ignore'
        })
      )
      expect(child.kill).not.toHaveBeenCalled()

      // The forced non-zero exit still counts as a successful login.
      child.emit('close', 1)
      await expect(loginPromise).resolves.toBeUndefined()
    } finally {
      Object.defineProperty(process, 'platform', originalPlatform)
      vi.useRealTimers()
      vi.doUnmock('node:child_process')
      vi.doUnmock('../../shared/child-process/run-process')
      vi.doUnmock('../codex-cli/command')
    }
  })

  it('waits for reauthentication to replace existing Windows auth before killing login', async () => {
    vi.resetModules()
    vi.useFakeTimers()
    const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      configurable: true
    })
    const child = new EventEmitter() as EventEmitter & {
      stdout: PassThrough
      stderr: PassThrough
      kill: () => void
      pid: number
      exitCode: number | null
      signalCode: string | null
    }
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.kill = vi.fn()
    child.pid = 4343
    child.exitCode = null
    child.signalCode = null
    const runProcessMock = vi.fn(async () => taskkillResult(0))
    vi.doMock('node:child_process', () => ({ spawn: vi.fn(() => child) }))
    vi.doMock('../../shared/child-process/run-process', () => ({ runProcess: runProcessMock }))
    vi.doMock('../codex-cli/command', () => ({
      resolveCodexCommand: () => 'codex'
    }))
    const authPath = join(testState.fakeHomeDir, 'auth.json')
    writeFileSync(
      authPath,
      createCodexAuthJson('user@example.com', 'provider-account-1', 'old-token'),
      'utf-8'
    )

    try {
      const { CodexAccountService } = await import('./service')
      const service = new CodexAccountService(
        createStore(createSettings()) as never,
        createRateLimits() as never,
        createRuntimeHome() as never
      )
      const loginPromise = (
        service as unknown as {
          runCodexLogin(managedHomePath: string): Promise<void>
        }
      ).runCodexLogin(testState.fakeHomeDir)

      await vi.advanceTimersByTimeAsync(6_000)
      expect(runProcessMock).not.toHaveBeenCalled()

      writeFileSync(
        authPath,
        createCodexAuthJson('user@example.com', 'provider-account-1', 'new-token'),
        'utf-8'
      )
      await vi.advanceTimersByTimeAsync(6_000)
      expect(runProcessMock).toHaveBeenCalledWith(
        expect.objectContaining({
          program: 'taskkill.exe',
          args: ['/pid', '4343', '/t', '/f'],
          stdio: 'ignore'
        })
      )

      child.emit('close', 1)
      await expect(loginPromise).resolves.toBeUndefined()
    } finally {
      Object.defineProperty(process, 'platform', originalPlatform)
      vi.useRealTimers()
      vi.doUnmock('node:child_process')
      vi.doUnmock('../../shared/child-process/run-process')
      vi.doUnmock('../codex-cli/command')
    }
  })

  it('delivers a Windows login timeout only after the async tree kill settles', async () => {
    vi.resetModules()
    vi.useFakeTimers()
    const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
    const child = new EventEmitter() as EventEmitter & {
      stdout: PassThrough
      stderr: PassThrough
      kill: () => void
      pid: number
      exitCode: number | null
      signalCode: string | null
    }
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.kill = vi.fn()
    child.pid = 4545
    child.exitCode = null
    child.signalCode = null
    let finishTaskkill: (result: ReturnType<typeof taskkillResult>) => void = () => {}
    const runProcessMock = vi.fn(
      () =>
        new Promise<ReturnType<typeof taskkillResult>>((resolve) => {
          finishTaskkill = resolve
        })
    )
    vi.doMock('node:child_process', () => ({ spawn: vi.fn(() => child) }))
    vi.doMock('../../shared/child-process/run-process', () => ({ runProcess: runProcessMock }))
    vi.doMock('../codex-cli/command', () => ({ resolveCodexCommand: () => 'codex' }))

    try {
      const { CodexAccountService } = await import('./service')
      const service = new CodexAccountService(
        createStore(createSettings()) as never,
        createRateLimits() as never,
        createRuntimeHome() as never
      )
      let settled = false
      const loginPromise = (
        service as unknown as {
          runCodexLogin(managedHomePath: string): Promise<void>
        }
      ).runCodexLogin(testState.fakeHomeDir)
      const rejection = expect(
        loginPromise.finally(() => {
          settled = true
        })
      ).rejects.toThrow('Codex sign-in took too long to finish.')

      await vi.advanceTimersByTimeAsync(180_000)
      expect(runProcessMock).toHaveBeenCalledOnce()
      // Why: rollback deletes the home, so it must wait until the tree no longer holds it.
      expect(settled).toBe(false)

      // A failed taskkill falls back to signalling the direct child.
      finishTaskkill(taskkillResult(128))
      await rejection
      expect(child.kill).toHaveBeenCalledTimes(1)
    } finally {
      Object.defineProperty(process, 'platform', originalPlatform)
      vi.useRealTimers()
      vi.doUnmock('node:child_process')
      vi.doUnmock('../../shared/child-process/run-process')
      vi.doUnmock('../codex-cli/command')
    }
  })
})
