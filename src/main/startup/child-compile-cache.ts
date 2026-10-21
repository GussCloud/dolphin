// Plain-Node safe (no electron import): child entrypoints, including Bun-built dolphind ones, load this.
import * as nodeModule from 'node:module'
import { basename, dirname } from 'node:path'
import { flushCompileCacheNowAndLater, MAIN_COMPILE_CACHE_DIR_NAME } from './main-compile-cache'

const NODE_COMPILE_CACHE_ENV = 'NODE_COMPILE_CACHE'

// Optional members: Bun and older runtimes lack them.
export type ChildCompileCacheModuleApi = {
  getCompileCacheDir?: () => string | undefined
  flushCompileCache?: () => void
}

function isDolphinCompileCacheRoot(directory: string | undefined): directory is string {
  // Why: never forward or strip a NODE_COMPILE_CACHE the user exported for their own tools.
  return directory !== undefined && basename(directory) === MAIN_COMPILE_CACHE_DIR_NAME
}

function activeDolphinCompileCacheRoot(moduleApi: ChildCompileCacheModuleApi): string | null {
  try {
    const versionDir = moduleApi.getCompileCacheDir?.()
    // Node appends a per-runtime subdirectory; children must get the root so they key their own.
    const root = versionDir ? dirname(versionDir) : undefined
    return isDolphinCompileCacheRoot(root) ? root : null
  } catch {
    return null
  }
}

/**
 * Env for a Dolphin-owned Node child: shares this process's compile cache, so Node enables it
 * before the child's entry is compiled. Disabled caches (dev, E2E, AppImage, failure) add nothing.
 */
export function withInheritedCompileCache(
  env: NodeJS.ProcessEnv,
  moduleApi: ChildCompileCacheModuleApi = nodeModule
): NodeJS.ProcessEnv {
  if (env[NODE_COMPILE_CACHE_ENV] !== undefined) {
    return env
  }
  const root = activeDolphinCompileCacheRoot(moduleApi)
  return root ? { ...env, [NODE_COMPILE_CACHE_ENV]: root } : env
}

/** First call in a child entrypoint that was spawned with {@link withInheritedCompileCache}. */
export function adoptInheritedCompileCache(
  moduleApi: ChildCompileCacheModuleApi = nodeModule,
  env: NodeJS.ProcessEnv = process.env
): void {
  // Why: PTY shells and plugin spawns inherit this env; user tools must not write into Dolphin's cache.
  if (isDolphinCompileCacheRoot(env[NODE_COMPILE_CACHE_ENV])) {
    delete env[NODE_COMPILE_CACHE_ENV]
  }
  const { flushCompileCache } = moduleApi
  if (!activeDolphinCompileCacheRoot(moduleApi) || typeof flushCompileCache !== 'function') {
    return
  }
  // Why: long-lived children are usually killed, which skips Node's exit-time write; flush once the entry has loaded.
  setTimeout(() => flushCompileCacheNowAndLater({ flushCompileCache }), 0).unref()
}
