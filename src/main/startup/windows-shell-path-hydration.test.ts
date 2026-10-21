import { describe, expect, it, vi } from 'vitest'
import { createWindowsShellPathHydration } from './windows-shell-path-hydration'
import type { HydrationResult } from './hydrate-shell-path'

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => {
    resolve = next
  })
  return { promise, resolve }
}

function success(segment: string): HydrationResult {
  return { segments: [segment], ok: true, failureReason: 'none' }
}

describe('Windows shell PATH hydration coordination', () => {
  it('serializes probes and never merges a superseded shell result', async () => {
    const first = deferred<HydrationResult>()
    const second = deferred<HydrationResult>()
    const hydrate = vi.fn<() => Promise<HydrationResult>>()
    hydrate.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const merge = vi.fn<(segments: string[]) => string[]>(() => [])
    const configure = vi.fn()
    const coordinator = createWindowsShellPathHydration({
      configure,
      hydrate,
      merge,
      resolveGitBashPath: (shell) => (shell === 'git-bash' ? 'C:\\Git\\bin\\bash.exe' : null)
    })

    const powerShellReady = coordinator.hydrate('powershell.exe')
    await vi.waitFor(() => expect(hydrate).toHaveBeenCalledTimes(1))
    const gitBashReady = coordinator.hydrate('git-bash')

    first.resolve(success('C:\\stale-powershell'))
    await vi.waitFor(() => expect(hydrate).toHaveBeenCalledTimes(2))
    expect(merge).not.toHaveBeenCalled()

    second.resolve(success('C:\\current-git-bash'))
    await Promise.all([powerShellReady, gitBashReady])

    expect(merge).toHaveBeenCalledOnce()
    expect(merge).toHaveBeenCalledWith(['C:\\current-git-bash'])
    expect(configure).toHaveBeenLastCalledWith('git-bash', 'C:\\Git\\bin\\bash.exe', null)
  })

  it('coalesces queued shell changes to the latest configured shell', async () => {
    const active = deferred<HydrationResult>()
    const latest = deferred<HydrationResult>()
    const hydrate = vi.fn<() => Promise<HydrationResult>>()
    hydrate.mockReturnValueOnce(active.promise).mockReturnValueOnce(latest.promise)
    const merge = vi.fn<(segments: string[]) => string[]>(() => [])
    const coordinator = createWindowsShellPathHydration({ hydrate, merge })

    const activeReady = coordinator.hydrate('powershell.exe')
    await vi.waitFor(() => expect(hydrate).toHaveBeenCalledTimes(1))
    const skippedReady = coordinator.hydrate('cmd.exe')
    const latestReady = coordinator.hydrate('powershell.exe')
    active.resolve(success('C:\\stale'))
    await vi.waitFor(() => expect(hydrate).toHaveBeenCalledTimes(2))
    latest.resolve(success('C:\\latest'))

    await Promise.all([activeReady, skippedReady, latestReady])
    expect(hydrate).toHaveBeenCalledTimes(2)
    expect(merge).toHaveBeenCalledOnce()
    expect(merge).toHaveBeenCalledWith(['C:\\latest'])
  })

  it('keeps the startup barrier behind shell changes queued while it waits', async () => {
    const first = deferred<HydrationResult>()
    const second = deferred<HydrationResult>()
    const hydrate = vi.fn<() => Promise<HydrationResult>>()
    hydrate.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const coordinator = createWindowsShellPathHydration({ hydrate })
    void coordinator.hydrate('powershell.exe', 'powershell.exe')
    await vi.waitFor(() => expect(hydrate).toHaveBeenCalledOnce())
    let startupReady = false
    const startupBarrier = coordinator.whenReady().then(() => {
      startupReady = true
    })

    void coordinator.hydrate('git-bash')
    first.resolve(success('C:\\stale'))
    await vi.waitFor(() => expect(hydrate).toHaveBeenCalledTimes(2))
    expect(startupReady).toBe(false)

    second.resolve(success('C:\\latest'))
    await startupBarrier
    expect(startupReady).toBe(true)
  })

  it('uses the terminal safety chain for a custom PowerShell path', () => {
    const configure = vi.fn()
    const coordinator = createWindowsShellPathHydration({
      configure,
      resolvePowerShellChain: () => [
        'C:\\Resolved\\pwsh.exe',
        'C:\\Resolved\\powershell.exe',
        'C:\\Resolved\\cmd.exe'
      ]
    })

    coordinator.configure('C:\\Program Files\\PowerShell\\7\\pwsh.exe', 'pwsh.exe')

    expect(configure).toHaveBeenCalledWith(
      'C:\\Resolved\\pwsh.exe',
      null,
      'C:\\Resolved\\powershell.exe'
    )
  })

  it('configures refresh callers without spawning in development', () => {
    const configure = vi.fn()
    const hydrate = vi.fn<() => Promise<HydrationResult>>()
    const coordinator = createWindowsShellPathHydration({
      configure,
      hydrate,
      resolveGitBashPath: () => 'C:\\Git\\bin\\bash.exe'
    })

    coordinator.configure('git-bash')

    expect(configure).toHaveBeenCalledWith('git-bash', 'C:\\Git\\bin\\bash.exe', null)
    expect(hydrate).not.toHaveBeenCalled()
  })

  it.each([
    {
      implementation: 'auto' as const,
      expectedShell: 'pwsh.exe',
      expectedFallback: 'powershell.exe'
    },
    {
      implementation: 'pwsh.exe' as const,
      expectedShell: 'pwsh.exe',
      expectedFallback: 'powershell.exe'
    },
    {
      implementation: 'powershell.exe' as const,
      expectedShell: 'powershell.exe',
      expectedFallback: null
    }
  ])(
    'configures $implementation to hydrate the effective PowerShell profile',
    ({ implementation, expectedShell, expectedFallback }) => {
      const configure = vi.fn()
      const coordinator = createWindowsShellPathHydration({
        configure,
        resolvePowerShellChain: (family) =>
          family === 'pwsh.exe'
            ? ['pwsh.exe', 'powershell.exe', 'cmd.exe']
            : ['powershell.exe', 'cmd.exe']
      })

      coordinator.configure('powershell.exe', implementation)

      expect(configure).toHaveBeenCalledWith(expectedShell, null, expectedFallback)
    }
  )

  it('reconfigures when the PowerShell implementation changes', () => {
    const configure = vi.fn()
    const coordinator = createWindowsShellPathHydration({
      configure,
      resolvePowerShellChain: (family) =>
        family === 'pwsh.exe'
          ? ['pwsh.exe', 'powershell.exe', 'cmd.exe']
          : ['powershell.exe', 'cmd.exe']
    })

    coordinator.configure('powershell.exe', 'powershell.exe')
    coordinator.configure('powershell.exe', 'pwsh.exe')

    expect(configure).toHaveBeenNthCalledWith(1, 'powershell.exe', null, null)
    expect(configure).toHaveBeenNthCalledWith(2, 'pwsh.exe', null, 'powershell.exe')
  })

  it('uses inbox PowerShell when pwsh has no safe executable behind its Store alias', () => {
    const configure = vi.fn()
    const coordinator = createWindowsShellPathHydration({
      configure,
      resolvePowerShellChain: () => [
        'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
        'C:\\Windows\\System32\\cmd.exe'
      ]
    })

    coordinator.configure('powershell.exe', 'auto')

    expect(configure).toHaveBeenCalledWith(
      'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
      null,
      null
    )
  })

  it('skips hydration when no PowerShell executable resolves safely', () => {
    const configure = vi.fn()
    const coordinator = createWindowsShellPathHydration({
      configure,
      resolvePowerShellChain: () => ['C:\\Windows\\System32\\cmd.exe']
    })

    coordinator.configure('powershell.exe', 'auto')

    expect(configure).toHaveBeenCalledWith('C:\\Windows\\System32\\cmd.exe', null, null)
  })

  describe('persisted PATH cache', () => {
    const powerShell = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
    const shellKey = JSON.stringify([powerShell, null, null])

    function createCoordinator(cached: string[] | null) {
      const probe = deferred<HydrationResult>()
      const hydrate = vi.fn<(options?: { keepAppliedPath?: boolean }) => Promise<HydrationResult>>(
        () => probe.promise
      )
      const merge = vi.fn<(segments: string[]) => string[]>(() => [])
      const persistedPath = {
        load: vi.fn<(key: string) => string[] | null>(() => cached),
        save: vi.fn<(key: string, segments: string[]) => void>()
      }
      const coordinator = createWindowsShellPathHydration({
        configure: vi.fn(),
        hydrate,
        merge,
        persistedPath,
        resolvePowerShellChain: () => [powerShell]
      })
      return { coordinator, hydrate, merge, persistedPath, probe }
    }

    it('applies the cached PATH and releases waiters before the probe finishes', async () => {
      const { coordinator, hydrate, merge, persistedPath, probe } = createCoordinator([
        'C:\\cached-profile'
      ])

      const refreshed = coordinator.hydrate('powershell.exe', 'powershell.exe')
      await coordinator.whenReady()

      expect(persistedPath.load).toHaveBeenCalledWith(shellKey)
      expect(merge).toHaveBeenCalledExactlyOnceWith(['C:\\cached-profile'])
      await vi.waitFor(() => expect(hydrate).toHaveBeenCalledWith({ keepAppliedPath: true }))

      probe.resolve(success('C:\\fresh-profile'))
      await refreshed
      expect(merge).toHaveBeenLastCalledWith(['C:\\fresh-profile'])
      expect(persistedPath.save).toHaveBeenCalledWith(shellKey, ['C:\\fresh-profile'])
    })

    it('waits for the probe and seeds the cache when nothing is persisted', async () => {
      const { coordinator, hydrate, merge, persistedPath, probe } = createCoordinator(null)
      let ready = false

      void coordinator.hydrate('powershell.exe', 'powershell.exe')
      const waiting = coordinator.whenReady().then(() => {
        ready = true
      })
      await vi.waitFor(() => expect(hydrate).toHaveBeenCalledWith(undefined))
      expect(ready).toBe(false)
      expect(merge).not.toHaveBeenCalled()

      probe.resolve(success('C:\\fresh-profile'))
      await waiting
      expect(merge).toHaveBeenCalledExactlyOnceWith(['C:\\fresh-profile'])
      expect(persistedPath.save).toHaveBeenCalledWith(shellKey, ['C:\\fresh-profile'])
    })

    it('keeps the cached file when the refresh probe fails', async () => {
      const { coordinator, merge, persistedPath, probe } = createCoordinator(['C:\\cached'])

      const refreshed = coordinator.hydrate('powershell.exe', 'powershell.exe')
      probe.resolve({ segments: [], ok: false, failureReason: 'timeout' })
      await refreshed

      expect(merge).toHaveBeenCalledExactlyOnceWith(['C:\\cached'])
      expect(persistedPath.save).not.toHaveBeenCalled()
    })

    it('reads the cache only for the launch probe', async () => {
      const { coordinator, persistedPath, probe } = createCoordinator(['C:\\cached'])
      probe.resolve(success('C:\\fresh'))

      await coordinator.hydrate('powershell.exe', 'powershell.exe')
      await coordinator.hydrate('powershell.exe', 'powershell.exe')

      expect(persistedPath.load).toHaveBeenCalledOnce()
    })
  })
})
