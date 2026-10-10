import { readdir, rm } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

export const MAIN_COMPILE_CACHE_DIR_NAME = 'node-compile-cache'
// Why: modules loaded after startup (locale chunks, lazy features) persist only on an explicit flush.
const LATE_FLUSH_DELAY_MS = 60_000

export type MainCompileCacheModuleApi = {
  enableCompileCache: (directory: string) => { status: number; directory?: string }
  flushCompileCache: () => void
  getCompileCacheDir: () => string | undefined
  constants: { compileCacheStatus: { ENABLED: number; ALREADY_ENABLED: number } }
}

export function resolveMainCompileCacheDir(options: {
  isPackaged: boolean
  appDataPath: string
  userDataDirName: string
  env: NodeJS.ProcessEnv
}): string | null {
  // Why: dev and E2E rebuild the bundle constantly and must not write into the packaged profile.
  if (!options.isPackaged || options.env.DOLPHIN_E2E_USER_DATA_DIR) {
    return null
  }
  // Why: AppImage mounts at a new path per launch, so path-keyed entries would never hit and only grow.
  if (options.env.APPIMAGE) {
    return null
  }
  // Why: per-user, never os.tmpdir() — a world-writable /tmp would let another user plant V8 code cache.
  return join(options.appDataPath, options.userDataDirName, MAIN_COMPILE_CACHE_DIR_NAME)
}

/** Enables Node's on-disk V8 code cache for this process; returns the flush to call once startup code is loaded. */
export function startMainCompileCache(
  directory: string | null,
  moduleApi: MainCompileCacheModuleApi
): () => void {
  if (!directory) {
    return () => {}
  }
  try {
    const { status } = moduleApi.enableCompileCache(directory)
    const { ENABLED, ALREADY_ENABLED } = moduleApi.constants.compileCacheStatus
    if (status !== ENABLED && status !== ALREADY_ENABLED) {
      return () => {}
    }
  } catch {
    return () => {}
  }
  const flush = (): void => {
    try {
      // Why: app.exit() skips Node's exit-time flush, so an unflushed cache never reaches disk.
      moduleApi.flushCompileCache()
    } catch {
      // A cache write failure only costs the next launch its warm start.
    }
  }
  return () => {
    flush()
    setTimeout(flush, LATE_FLUSH_DELAY_MS).unref()
    void pruneStaleMainCompileCacheVersions(moduleApi.getCompileCacheDir())
  }
}

/** Node keys the cache by a per-runtime subdirectory; an Electron update leaves the old one orphaned. */
export async function pruneStaleMainCompileCacheVersions(
  activeVersionDir: string | undefined
): Promise<void> {
  if (!activeVersionDir) {
    return
  }
  const root = dirname(activeVersionDir)
  if (basename(root) !== MAIN_COMPILE_CACHE_DIR_NAME) {
    return
  }
  const activeName = basename(activeVersionDir)
  try {
    const entries = await readdir(root, { withFileTypes: true })
    await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && entry.name !== activeName)
        .map((entry) => rm(join(root, entry.name), { recursive: true, force: true }))
    )
  } catch {
    // Stale versions only cost disk; a later launch retries.
  }
}
