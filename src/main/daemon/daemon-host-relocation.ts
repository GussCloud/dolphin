import { FORK_IDENTITY } from '../../shared/fork-identity'
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { join, win32 as winPath } from 'node:path'
import { getAppEnvironment } from '../../shared/app-environment'
import {
  buildDaemonHostManifest,
  daemonHostExeName,
  destPath,
  executeManifest,
  toPosixRelative,
  WINDOWS_PROCESS_TREE_REQUIRED,
  type DaemonHostSources
} from './daemon-host-manifest'
import {
  DAEMON_HOST_CHUNK_MANIFEST_NAME,
  parseDaemonHostChunkManifest
} from './daemon-host-chunk-manifest'

/**
 * Relocate the terminal daemon's process image out of the app install dir into LOCAL userData so it
 * survives Windows auto-updates: the NSIS installer deletes the old install and force-kills every process
 * imaged under it, which would otherwise kill the daemon and its live terminals. The relocated exe is a
 * run-as-node Dolphin.exe copy (not node.exe) so there's no console flash and asar still resolves. Fail-open:
 * any failure returns null and the caller forks the install-dir host (pre-relocation behavior).
 *
 * What escapes the updater is the PATH, not the file name: electron-builder's kill sweep selects
 * processes whose image path sits under $INSTDIR. See docs/reference/windows-daemon-host-relocation.md
 * for the survival contract and why the exe is copied verbatim rather than renamed.
 */

export type RelocatedDaemonHost = {
  /** The relocated host exe to fork the daemon from (run as node). */
  execPath: string
  /** The copied daemon-entry.js, mirrored under the relocated resources tree. */
  entryPath: string
}

const HOST_SUBDIR = 'daemon-host'
const MARKER_NAME = '.materialized.json'
/** Staging dirs are `<version>.staging-<hex>`; pruning recognises in-flight copies by this. */
export const STAGING_INFIX = '.staging-'

// LOCAL appData (not roaming) so OneDrive/roaming never syncs this ~260MB runtime. Shared with NSIS uninstall (config/nsis/dolphin-installer-hooks.nsh) — keep in sync.
// Why productName: matches the NSIS `${PRODUCT_NAME}` dir, and keeps a fork's copies apart from Dolphin's.
const LOCAL_HOST_ROOT_NAME = FORK_IDENTITY.productName

type MaterializeMarker = {
  version: string
  completedAt: string
  entryRelPath: string
}

// Mirror getDaemonEntryPath()'s resolution order so the copied entry is the exact file the in-dir fork would run.
function resolveEntrySourcePath(resourcesPath: string): string {
  const unpackedRoot = join(resourcesPath, 'app.asar.unpacked')
  const direct = join(unpackedRoot, 'daemon-entry.js')
  if (existsSync(direct)) {
    return direct
  }
  return join(unpackedRoot, 'out', 'main', 'daemon-entry.js')
}

/**
 * Whether this process is a packaged ELECTRON app on win32 — the only shape relocation
 * addresses, because what it escapes is the NSIS updater's kill zone.
 *
 * Why asar and not isPackaged alone: dolphind answers isPackaged() true (it is a shipped build,
 * not a dev checkout) while having no asar, no resourcesPath and no NSIS installer. Asking
 * whether the app root is an asar archive is the same honesty fix the watcher path uses, and
 * it keeps a Node host from staging a copy of an Electron tree it does not have.
 */
export function isPackagedElectronWin32(): boolean {
  const environment = getAppEnvironment()
  return (
    process.platform === 'win32' &&
    environment.isPackaged() &&
    environment.getAppPath().includes('app.asar')
  )
}

// Missing or unreadable (older layout, dev build) copies every chunk: slower, never broken.
function readDaemonChunkFiles(entrySourcePath: string): readonly string[] | null {
  try {
    return parseDaemonHostChunkManifest(
      readFileSync(join(winPath.dirname(entrySourcePath), DAEMON_HOST_CHUNK_MANIFEST_NAME), 'utf8')
    )
  } catch {
    return null
  }
}

// Relocation inputs from the live packaged process, or null when it doesn't apply (non-win32, dev, or missing resourcesPath).
function collectDaemonHostSources(): DaemonHostSources | null {
  if (!isPackagedElectronWin32()) {
    return null
  }
  const resourcesPath = process.resourcesPath
  if (typeof resourcesPath !== 'string' || resourcesPath.length === 0) {
    return null
  }
  const execPath = process.execPath
  const appDir = winPath.dirname(execPath)
  const entrySourcePath = resolveEntrySourcePath(resourcesPath)
  return {
    appDir,
    execPath,
    resourcesPath,
    entrySourcePath,
    entryRelPath: toPosixRelative(appDir, entrySourcePath),
    windowsProcessTreeDir: join(resourcesPath, 'node_modules', '@vscode', 'windows-process-tree'),
    daemonChunkFiles: readDaemonChunkFiles(entrySourcePath)
  }
}

function readMarker(dir: string): MaterializeMarker | null {
  try {
    const parsed = JSON.parse(
      readFileSync(join(dir, MARKER_NAME), 'utf8')
    ) as Partial<MaterializeMarker>
    if (typeof parsed.version === 'string' && typeof parsed.entryRelPath === 'string') {
      return {
        version: parsed.version,
        completedAt: typeof parsed.completedAt === 'string' ? parsed.completedAt : '',
        entryRelPath: parsed.entryRelPath
      }
    }
  } catch {
    // Missing/corrupt marker — treat as not materialized.
  }
  return null
}

function processTreeRelDir(sources: DaemonHostSources): string {
  return toPosixRelative(sources.appDir, sources.windowsProcessTreeDir)
}

/** True when any file require() needs is absent from a copy of the package. */
function missingProcessTreeFiles(packageDir: string): boolean {
  return WINDOWS_PROCESS_TREE_REQUIRED.some(
    (relative) => !existsSync(join(packageDir, ...relative.split('/')))
  )
}

export function hostRootDir(): string {
  // Prefer LOCAL appData (see LOCAL_HOST_ROOT_NAME); fall back to userData only if LOCALAPPDATA is unset.
  const localAppData = process.env.LOCALAPPDATA
  const base =
    typeof localAppData === 'string' && localAppData.length > 0
      ? join(localAppData, LOCAL_HOST_ROOT_NAME)
      : getAppEnvironment().getPath('userData')
  return join(base, HOST_SUBDIR)
}

/**
 * The relocated host for the current version, or null. Valid only when the marker matches this version
 * AND the exe + entry exist, so a partial or stale copy never reports ready.
 */
export function getRelocatedDaemonHost(): RelocatedDaemonHost | null {
  const sources = collectDaemonHostSources()
  if (!sources) {
    return null
  }
  const version = getAppEnvironment().getVersion()
  const dest = join(hostRootDir(), version)
  const marker = readMarker(dest)
  if (!marker || marker.version !== version) {
    return null
  }
  const execPath = join(dest, daemonHostExeName(sources.execPath))
  const entryPath = destPath(dest, marker.entryRelPath)
  if (!existsSync(execPath) || !existsSync(entryPath)) {
    return null
  }
  // A mirror the daemon cannot load the addon from still runs -- it just forks a
  // shell per snapshot (#16905) -- so treat it as unmaterialized and rebuild. Hosts
  // from before this shipped have none of these files. Checked in the mirror, never
  // in the install dir, which is the thing relocation exists to outlive.
  if (missingProcessTreeFiles(destPath(dest, processTreeRelDir(sources)))) {
    return null
  }
  return { execPath, entryPath }
}

// Why shared: a respawn racing the startup launch must neither stage a second ~250MB copy nor
// remove the dest the first one just published.
let materializationInFlight: Promise<RelocatedDaemonHost | null> | null = null

/**
 * Materialize the current version's daemon host, resolving its fork paths or null (fail-open). Idempotent
 * via marker; stages into a temp sibling and publishes by atomic rename, so a crash mid-copy never leaves a
 * half-populated dest. Async so the ~250MB copy runs on the libuv threadpool, not the Electron main thread.
 */
export function materializeRelocatedDaemonHost(): Promise<RelocatedDaemonHost | null> {
  materializationInFlight ??= materializeOnce().finally(() => {
    materializationInFlight = null
  })
  return materializationInFlight
}

async function discardStaging(staging: string): Promise<void> {
  try {
    await rm(staging, { recursive: true, force: true })
  } catch {
    // Best-effort staging cleanup.
  }
}

async function materializeOnce(): Promise<RelocatedDaemonHost | null> {
  const existing = getRelocatedDaemonHost()
  if (existing) {
    return existing
  }
  const sources = collectDaemonHostSources()
  if (!sources) {
    return null
  }
  // Checked against the source before copying: the mirror check below would refuse
  // the result anyway, and re-copying ~260MB on every launch to reach that verdict
  // is the loop this shares its list with the copy plan to prevent.
  if (missingProcessTreeFiles(sources.windowsProcessTreeDir)) {
    return null
  }
  const version = getAppEnvironment().getVersion()
  const root = hostRootDir()
  const dest = join(root, version)
  const staging = join(root, `${version}${STAGING_INFIX}${randomBytes(6).toString('hex')}`)
  try {
    await mkdir(root, { recursive: true })
    await executeManifest(buildDaemonHostManifest(sources), staging)
    // Marker written LAST so an interrupted copy leaves a marker-less staging dir that pruning reclaims.
    const marker: MaterializeMarker = {
      version,
      completedAt: new Date().toISOString(),
      entryRelPath: sources.entryRelPath
    }
    await writeFile(join(staging, MARKER_NAME), JSON.stringify(marker))
    // Why: another app instance may have published this version while we copied. Its host is
    // identical, and removing it could pull files from under a daemon it is forking right now.
    const published = getRelocatedDaemonHost()
    if (published) {
      await discardStaging(staging)
      return published
    }
    // Replace any stale/partial dest, then publish atomically. Windows refuses to delete a running
    // image, so a live daemon already hosted in THIS version's dir (same-version reinstall, or a dev
    // channel reusing a version) throws here and materialization fails open to the install-dir host.
    await rm(dest, { recursive: true, force: true })
  } catch {
    await discardStaging(staging)
    return null
  }
  try {
    await rename(staging, dest)
  } catch {
    // A peer published between our rm and rename; its rename is atomic, so a valid dest is whole.
    await discardStaging(staging)
  }
  return getRelocatedDaemonHost()
}
