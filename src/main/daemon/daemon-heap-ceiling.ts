// The terminal daemon's V8 old-space ceiling.
// Why: one daemon hosts every PTY, so a runaway heap swaps the whole host before V8's own
// limit (up to 4 GB) trips. A lower, explicit ceiling makes it fail fast; the app then
// replaces the daemon and cold-restores sessions from their checkpoints.
import { totalmem } from 'node:os'

export const DAEMON_MAX_OLD_SPACE_ENV = 'DOLPHIN_DAEMON_MAX_OLD_SPACE_MB'

const MB = 1024 * 1024
// Why 2 GB: ~4× the 512 MB daemon warning budget (diagnostics/memory-budget.ts), and the
// 1000-row scrollback window keeps 100 terminals near ~200 MB of grid.
const DEFAULT_CEILING_MB = 2048
const MIN_CEILING_MB = 512

/** Megabytes for `--max-old-space-size`, or null to leave V8's default in place. */
export function resolveDaemonMaxOldSpaceMb(
  env: NodeJS.ProcessEnv = process.env,
  totalMemoryBytes: number = totalmem()
): number | null {
  const raw = env[DAEMON_MAX_OLD_SPACE_ENV]?.trim().toLowerCase()
  if (raw === '0' || raw === 'off') {
    return null
  }
  const override = Number(raw)
  if (raw && Number.isInteger(override) && override >= MIN_CEILING_MB) {
    return override
  }
  // Why a quarter of RAM on small hosts: that is V8's own heuristic, so the default never
  // raises the limit above what the daemon would have had without the flag.
  const quarterOfRamMb = Math.floor(totalMemoryBytes / MB / 4)
  return Math.min(DEFAULT_CEILING_MB, Math.max(MIN_CEILING_MB, quarterOfRamMb))
}

/**
 * Engine flags placed before the daemon's entry module. Empty when the launching runtime is
 * Bun (dolphind): the daemon then inherits Bun's JSC engine, which has no such flag.
 */
export function daemonHeapCeilingExecArgv(
  env: NodeJS.ProcessEnv = process.env,
  totalMemoryBytes?: number,
  launcherIsBun: boolean = typeof process.versions.bun === 'string'
): string[] {
  if (launcherIsBun) {
    return []
  }
  const ceilingMb = resolveDaemonMaxOldSpaceMb(env, totalMemoryBytes)
  return ceilingMb === null ? [] : [`--max-old-space-size=${ceilingMb}`]
}
