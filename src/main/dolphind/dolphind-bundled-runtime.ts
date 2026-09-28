import { existsSync, realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { constants } from 'node:os'
import { spawnProcess } from '../../shared/child-process/run-process'
import {
  DOLPHIND_BUILD_TARGET_FILENAME,
  DOLPHIND_VERSION_FILENAME,
  dolphindBunRuntimeFilename
} from '../../shared/dolphind-artifacts'
import { DOLPHIND_BUN_VERSION } from '../../shared/dolphind-bun-runtime'

export class DolphindBundledRuntimeError extends Error {}
export const DOLPHIND_BUNDLED_LAUNCHER_ENV = 'DOLPHIN_BUNDLED_LAUNCHER_CHANNEL'

/** Keep old Node service commands usable without letting Node open the profile. */
export function handoffToBundledDolphind(): boolean {
  const script = process.argv[1]
  if (!script) {
    return false
  }
  const entry = realpathSync(script)
  const directory = dirname(entry)
  const runtime = join(directory, dolphindBunRuntimeFilename(process.platform))
  const hasTarget = existsSync(join(directory, DOLPHIND_BUILD_TARGET_FILENAME))
  const hasRuntime = existsSync(runtime)
  if (!hasTarget && !hasRuntime && !existsSync(join(directory, DOLPHIND_VERSION_FILENAME))) {
    return false
  }
  if (!hasTarget) {
    throw new DolphindBundledRuntimeError('The bundled Dolphin runtime target is missing')
  }
  if (!hasRuntime) {
    throw new DolphindBundledRuntimeError('The bundled Dolphin runtime is missing')
  }
  if (realpathSync(process.execPath) === realpathSync(runtime)) {
    if (process.versions.bun !== DOLPHIND_BUN_VERSION) {
      throw new DolphindBundledRuntimeError(
        `The bundled Dolphin runtime must be Bun ${DOLPHIND_BUN_VERSION}`
      )
    }
    return false
  }
  const child = spawnProcess({
    program: runtime,
    args: [entry, ...process.argv.slice(2)],
    env: { ...process.env, [DOLPHIND_BUNDLED_LAUNCHER_ENV]: '1' },
    // Windows' default child job kills Bun before it can drain on launcher disconnect.
    detached: true,
    stdio: ['inherit', 'inherit', 'inherit', 'ipc']
  })
  // Node resets nohup's disposition; headless runtimes stop through INT/TERM or owner loss.
  const ignoreHangup = (): void => {}
  if (process.platform !== 'win32') {
    process.on('SIGHUP', ignoreHangup)
  }
  const forwards = (['SIGINT', 'SIGTERM'] as const).map((signal) => {
    const forward = (): void => {
      if (process.platform === 'win32') {
        // Detached Windows children have a separate console; kill() skips durable shutdown.
        if (child.connected) {
          child.disconnect()
        }
      } else {
        child.kill(signal)
      }
    }
    process.on(signal, forward)
    return { signal, forward }
  })
  const cleanup = (): void => {
    process.off('SIGHUP', ignoreHangup)
    for (const { signal, forward } of forwards) {
      process.off(signal, forward)
    }
  }
  child.once('error', (error) => {
    cleanup()
    console.error('dolphind: could not start the bundled runtime:', error.message)
    process.exit(78)
  })
  child.once('exit', (code, signal) => {
    cleanup()
    if (signal && process.platform !== 'win32') {
      process.kill(process.pid, signal)
      return
    }
    process.exit(code ?? (signal ? 128 + constants.signals[signal] : 1))
  })
  return true
}
