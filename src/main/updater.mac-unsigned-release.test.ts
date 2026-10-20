import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as UpdaterModule from './updater'
import type * as MacUnsignedReleaseModule from './mac-unsigned-release'
import { loadUpdaterModule, warmUpdaterModule } from './updater-test-module-loader'
import type { UpdateStatus } from '../shared/update-status-types'

const {
  autoUpdaterMock,
  recordUpdaterLifecycleMock,
  fetchNewerReleaseTagsMock,
  moduleFactories,
  resetUpdaterMocks
} = await vi.hoisted(async () => (await import('./updater-test-harness')).createUpdaterMocks())
const { isUnsignedMacReleaseMock } = vi.hoisted(() => ({
  isUnsignedMacReleaseMock: vi.fn<() => boolean>(() => false)
}))

vi.mock('electron', () => moduleFactories.electron())
vi.mock('electron-updater', () => moduleFactories.electronUpdater())
vi.mock('./electron-updater-loader', () => moduleFactories.electronUpdaterLoader())
vi.mock('@electron-toolkit/utils', () => moduleFactories.electronToolkitUtils())
vi.mock('./ipc/pty', () => moduleFactories.ipcPty())
vi.mock('./linux-update-package-type', () => moduleFactories.linuxUpdatePackageType())
vi.mock('./updater-lifecycle-diagnostics', () => moduleFactories.updaterLifecycleDiagnostics())
vi.mock('./updater-changelog', () => moduleFactories.updaterChangelog())
vi.mock('./updater-nudge', () => moduleFactories.updaterNudge())
vi.mock('./update-install-exit-watchdog', () => moduleFactories.updateInstallExitWatchdog())
vi.mock('./updater-prerelease-feed', () => moduleFactories.updaterPrereleaseFeed())
vi.mock('./local-builds/local-build-switch', () => moduleFactories.localBuildSwitch())
vi.mock('./local-builds/local-build-feed-server', () => moduleFactories.localBuildFeedServer())
vi.mock('./mac-unsigned-release', async (importOriginal) => ({
  ...(await importOriginal<typeof MacUnsignedReleaseModule>()),
  isUnsignedMacRelease: isUnsignedMacReleaseMock
}))

const UNSIGNED_MESSAGE =
  'This copy of Dolphin for macOS is not signed by Apple, so it cannot install updates itself. Download the new .dmg from the release page and drag Dolphin to Applications to update.'

warmUpdaterModule()

describe('updater on an unsigned macOS release', () => {
  beforeEach(() => {
    resetUpdaterMocks()
    isUnsignedMacReleaseMock.mockReset().mockReturnValue(false)
  })

  async function startUpdater(
    unsigned: boolean
  ): Promise<{ send: ReturnType<typeof vi.fn>; updater: typeof UpdaterModule }> {
    isUnsignedMacReleaseMock.mockReturnValue(unsigned)
    vi.useFakeTimers()
    fetchNewerReleaseTagsMock.mockResolvedValue({ tags: ['v1.0.61'], state: 'ready' })
    autoUpdaterMock.checkForUpdates.mockImplementation(() => {
      autoUpdaterMock.emit('checking-for-update')
      queueMicrotask(() => autoUpdaterMock.emit('update-available', { version: '1.0.61' }))
      return Promise.resolve(undefined)
    })
    const send = vi.fn()
    const updater = await loadUpdaterModule()
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the updater only calls webContents.send on this window stub.
    updater.setupAutoUpdater({ webContents: { send } } as never, {
      getLastUpdateCheckAt: () => Date.now(),
      installMode: 'interactive'
    })
    updater.checkForUpdatesFromMenu()
    await vi.advanceTimersByTimeAsync(0)
    return { send, updater }
  }

  function lastStatus(send: ReturnType<typeof vi.fn>): UpdateStatus | undefined {
    return send.mock.calls.findLast(([channel]) => channel === 'updater:status')?.[1]
  }

  it('offers the release without a download it could never install', async () => {
    const { send } = await startUpdater(true)

    expect(lastStatus(send)).toEqual({
      state: 'available',
      version: '1.0.61',
      changelog: null,
      externallyManaged: true,
      unsignedMacRelease: true
    })
  })

  it('refuses the download and points the user at the .dmg', async () => {
    const { send, updater } = await startUpdater(true)

    updater.downloadUpdate()
    await vi.advanceTimersByTimeAsync(0)

    expect(autoUpdaterMock.downloadUpdate).not.toHaveBeenCalled()
    expect(lastStatus(send)).toEqual({
      state: 'error',
      message: UNSIGNED_MESSAGE,
      version: '1.0.61',
      retryable: false
    })
    expect(recordUpdaterLifecycleMock).toHaveBeenCalledWith(
      'mac_unsigned_release_download_blocked',
      { version: '1.0.61' }
    )
  })

  it('leaves a signed build able to download', async () => {
    const { send, updater } = await startUpdater(false)
    autoUpdaterMock.downloadUpdate.mockResolvedValue([])

    expect(lastStatus(send)).toEqual({ state: 'available', version: '1.0.61', changelog: null })
    updater.downloadUpdate()
    await vi.advanceTimersByTimeAsync(0)

    expect(autoUpdaterMock.downloadUpdate).toHaveBeenCalled()
  })
})
