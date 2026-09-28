import { beforeEach, describe, expect, it, vi } from 'vitest'

function installRegistryMock(): {
  configureForDolphinProfileMock: ReturnType<typeof vi.fn>
  configureRouteSessionsForDolphinProfileMock: ReturnType<typeof vi.fn>
  configurePairedRuntimeBrowserClientHostsForDolphinProfileMock: ReturnType<typeof vi.fn>
  collectOrphanedBrowserRoutePartitionStorageMock: ReturnType<typeof vi.fn>
  applyPendingCookieImportMock: ReturnType<typeof vi.fn>
  initializeBrowserSessionsFromPersistedStateMock: ReturnType<typeof vi.fn>
} {
  const configureForDolphinProfileMock = vi.fn()
  const configureRouteSessionsForDolphinProfileMock = vi.fn()
  const configurePairedRuntimeBrowserClientHostsForDolphinProfileMock = vi.fn()
  const collectOrphanedBrowserRoutePartitionStorageMock = vi.fn(async () => [])
  const applyPendingCookieImportMock = vi.fn()
  const initializeBrowserSessionsFromPersistedStateMock = vi.fn()

  vi.doMock('./browser-session-registry', () => ({
    browserSessionRegistry: {
      configureForDolphinProfile: configureForDolphinProfileMock,
      applyPendingCookieImport: applyPendingCookieImportMock,
      initializeBrowserSessionsFromPersistedState: initializeBrowserSessionsFromPersistedStateMock
    }
  }))
  vi.doMock('./browser-route-session-runtime', () => ({
    configureRouteSessionsForDolphinProfile: configureRouteSessionsForDolphinProfileMock
  }))
  vi.doMock('./browser-route-partition-storage-runtime', () => ({
    collectOrphanedBrowserRoutePartitionStorage: collectOrphanedBrowserRoutePartitionStorageMock
  }))
  vi.doMock('./paired-runtime-browser-client-host-runtime', () => ({
    configurePairedRuntimeBrowserClientHostsForDolphinProfile:
      configurePairedRuntimeBrowserClientHostsForDolphinProfileMock
  }))

  return {
    configureForDolphinProfileMock,
    configureRouteSessionsForDolphinProfileMock,
    configurePairedRuntimeBrowserClientHostsForDolphinProfileMock,
    collectOrphanedBrowserRoutePartitionStorageMock,
    applyPendingCookieImportMock,
    initializeBrowserSessionsFromPersistedStateMock
  }
}

describe('initializeBrowserSessionsForApp', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('replays pending cookie imports before initializing browser sessions', async () => {
    const { applyPendingCookieImportMock, initializeBrowserSessionsFromPersistedStateMock } =
      installRegistryMock()
    const { initializeBrowserSessionsForApp } = await import('./browser-session-startup')

    initializeBrowserSessionsForApp()

    expect(applyPendingCookieImportMock).toHaveBeenCalledOnce()
    expect(initializeBrowserSessionsFromPersistedStateMock).toHaveBeenCalledOnce()
    expect(applyPendingCookieImportMock.mock.invocationCallOrder[0]).toBeLessThan(
      initializeBrowserSessionsFromPersistedStateMock.mock.invocationCallOrder[0]
    )
  })

  it('configures the active Dolphin profile before replaying browser sessions', async () => {
    const {
      configureForDolphinProfileMock,
      configureRouteSessionsForDolphinProfileMock,
      configurePairedRuntimeBrowserClientHostsForDolphinProfileMock,
      applyPendingCookieImportMock,
      initializeBrowserSessionsFromPersistedStateMock
    } = installRegistryMock()
    const { initializeBrowserSessionsForApp } = await import('./browser-session-startup')

    initializeBrowserSessionsForApp({
      dolphinProfileId: 'local-work',
      profileDirectory: '/profiles/local-work'
    })

    expect(configureForDolphinProfileMock).toHaveBeenCalledWith({
      dolphinProfileId: 'local-work',
      profileDirectory: '/profiles/local-work'
    })
    expect(configureRouteSessionsForDolphinProfileMock).toHaveBeenCalledWith({
      dolphinProfileId: 'local-work',
      profileDirectory: '/profiles/local-work'
    })
    expect(configurePairedRuntimeBrowserClientHostsForDolphinProfileMock).toHaveBeenCalledWith({
      dolphinProfileId: 'local-work'
    })
    expect(configureForDolphinProfileMock.mock.invocationCallOrder[0]).toBeLessThan(
      applyPendingCookieImportMock.mock.invocationCallOrder[0]
    )
    expect(configureRouteSessionsForDolphinProfileMock.mock.invocationCallOrder[0]).toBeLessThan(
      applyPendingCookieImportMock.mock.invocationCallOrder[0]
    )
    expect(
      configurePairedRuntimeBrowserClientHostsForDolphinProfileMock.mock.invocationCallOrder[0]
    ).toBeLessThan(applyPendingCookieImportMock.mock.invocationCallOrder[0])
    expect(applyPendingCookieImportMock.mock.invocationCallOrder[0]).toBeLessThan(
      initializeBrowserSessionsFromPersistedStateMock.mock.invocationCallOrder[0]
    )
  })

  it('sweeps orphaned route partitions once the profile binding runtime is configured', async () => {
    const {
      configureRouteSessionsForDolphinProfileMock,
      collectOrphanedBrowserRoutePartitionStorageMock
    } = installRegistryMock()
    const { initializeBrowserSessionsForApp } = await import('./browser-session-startup')

    initializeBrowserSessionsForApp({
      dolphinProfileId: 'local-work',
      profileDirectory: '/profiles/local-work'
    })

    expect(collectOrphanedBrowserRoutePartitionStorageMock).toHaveBeenCalledOnce()
    // Hoisting the sweep above the binding runtime leaves it with no active profile and it collects nothing.
    expect(configureRouteSessionsForDolphinProfileMock.mock.invocationCallOrder[0]).toBeLessThan(
      collectOrphanedBrowserRoutePartitionStorageMock.mock.invocationCallOrder[0]
    )
  })

  it('does not sweep route partitions when no profile is active', async () => {
    const { collectOrphanedBrowserRoutePartitionStorageMock } = installRegistryMock()
    const { initializeBrowserSessionsForApp } = await import('./browser-session-startup')

    initializeBrowserSessionsForApp()

    expect(collectOrphanedBrowserRoutePartitionStorageMock).not.toHaveBeenCalled()
  })

  it('initializes browser sessions once per app process', async () => {
    const { applyPendingCookieImportMock, initializeBrowserSessionsFromPersistedStateMock } =
      installRegistryMock()
    const { initializeBrowserSessionsForApp } = await import('./browser-session-startup')

    initializeBrowserSessionsForApp()
    initializeBrowserSessionsForApp()

    expect(applyPendingCookieImportMock).toHaveBeenCalledOnce()
    expect(initializeBrowserSessionsFromPersistedStateMock).toHaveBeenCalledOnce()
  })

  it('retries if initialization fails before completion', async () => {
    const { applyPendingCookieImportMock, initializeBrowserSessionsFromPersistedStateMock } =
      installRegistryMock()
    initializeBrowserSessionsFromPersistedStateMock.mockImplementationOnce(() => {
      throw new Error('session init failed')
    })
    const { initializeBrowserSessionsForApp } = await import('./browser-session-startup')

    expect(() => initializeBrowserSessionsForApp()).toThrow('session init failed')
    initializeBrowserSessionsForApp()

    expect(applyPendingCookieImportMock).toHaveBeenCalledTimes(2)
    expect(initializeBrowserSessionsFromPersistedStateMock).toHaveBeenCalledTimes(2)
  })
})
