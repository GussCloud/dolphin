import type { PtySpawnIpcDeps } from '../../ipc/pty/ipc/spawn-types'
import type { PtyRuntimeControllerDeps } from '../../ipc/pty/runtime/controller-deps'
import type { DolphinRuntimeService } from '../../runtime/dolphin-runtime'
import type { Store } from './store'

function unexpectedPreflight(): never {
  throw new Error('Spawn commit must not rerun preflight')
}

export function createPtySpawnCommitDependencies(
  runtime: DolphinRuntimeService,
  store: Store
): PtySpawnIpcDeps & PtyRuntimeControllerDeps {
  return {
    runtime,
    store,
    sendPtySpawnedToRenderer: () => {},
    getLocalPtyStartupPromise: unexpectedPreflight,
    getLocalPtyProviderStartupPromise: unexpectedPreflight,
    adoptStablePane: unexpectedPreflight,
    assertFolderWorkspacePtyPathUsable: unexpectedPreflight,
    resolvePtySpawnStartupCwd: unexpectedPreflight,
    localStartupCwdDirectoryExists: unexpectedPreflight,
    prepareCodexResumeHome: unexpectedPreflight,
    noCodexResumeLaunch: unexpectedPreflight,
    resolveCodexResumeLaunch: unexpectedPreflight,
    reconcileSharedRuntimeResumeHome: unexpectedPreflight,
    stripSequencedStartupResumeArgv: unexpectedPreflight,
    transitionSpawnHiddenRendererPtyDeliveryState: unexpectedPreflight,
    trustedTerminalHandleEnv: new Set(),
    syncPtyBackgroundedDelivery: unexpectedPreflight,
    stopReplacedPty: unexpectedPreflight,
    requestSerializedBuffer: unexpectedPreflight,
    shutdownProviderAndDetectExit: unexpectedPreflight,
    rememberSyntheticKillExit: unexpectedPreflight,
    rememberRetiredRejectedPty: unexpectedPreflight,
    sendPtyExitToRenderer: unexpectedPreflight,
    finishPtyShutdown: unexpectedPreflight,
    retiredRejectedPtyIds: new Map(),
    reversibleStopOwnersByPtyId: new Map(),
    get mainWindow() {
      return unexpectedPreflight()
    }
  }
}
