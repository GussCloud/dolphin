import { parseWslUncPath } from './wsl-paths'

const WINDOWS_PARALLEL_CHECKOUT_GIT_ARGS = ['-c', 'checkout.workers=0'] as const

/**
 * Global `git -c` option that writes a checkout's files on one worker per core.
 *
 * Why Windows only: per-file create cost (Defender scans each write) dominates there, and
 * a 30k-file checkout measured 18s sequential vs 7s parallel. Git < 2.32 ignores the key,
 * so the 2.25 baseline is unaffected. WSL paths opt out like `windowsLongPathGitArgs`.
 */
export function windowsParallelCheckoutGitArgs(
  cwd: string,
  platform: NodeJS.Platform = process.platform
): string[] {
  if (platform !== 'win32' || parseWslUncPath(cwd)) {
    return []
  }
  return [...WINDOWS_PARALLEL_CHECKOUT_GIT_ARGS]
}
