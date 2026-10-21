import { toWindowsWslPath } from '../shared/wsl-paths'
import { wslDistroListRetryDelayMs } from './wsl-distro-retry'
import { clearWslHomeCache, getCachedWslHome, rememberWslHome } from './wsl-home-cache'
import { runWslProcess } from './wsl/wsl-runner'

/** Non-interactive `bash -c` reads no rc file, so stdout is just the answer — no fence needed. */
export const WSL_HOME_GUEST_ARGV = ['bash', '-c', 'echo $HOME'] as const
export const WSL_HOME_PROBE_TIMEOUT_MS = 5000

const wslHomeProbesInFlight = new Map<string, Promise<string | null>>()
// Sync-read backoff only: async callers still probe on every miss.
const wslHomeProbeFailures = new Map<string, { retryAfterMs: number; streak: number }>()

/**
 * Sync home read; `probeSync` (stdout, may throw) runs only on a cold, never-failed distro.
 * Result is cached per distro for the process lifetime.
 */
export function readWslHomeSync(distro: string, probeSync: () => string): string | null {
  const cachedHome = getCachedWslHome(distro)
  if (cachedHome !== undefined) {
    return cachedHome
  }
  // Why bound the entry (wsl-probe-failure-semantics.md): allowed-roots runs this twice per
  // filesystem IPC, so after a failed probe sync readers get null at once and re-ask off-thread
  // on a backoff until an answer lands. Placement-critical callers use the async twin instead.
  const failure = wslHomeProbeFailures.get(distro)
  if (failure) {
    if (Date.now() >= failure.retryAfterMs && !wslHomeProbesInFlight.has(distro)) {
      void getWslHomeAsync(distro)
    }
    return null
  }

  let stdout = ''
  try {
    stdout = probeSync()
  } catch {
    // Could not ask: recorded below as a failed probe, never as an answer.
  }
  return rememberWslHomeProbe(distro, stdout)
}

/** Probes on every cache miss; concurrent callers for one distro share the spawn. */
export function getWslHomeAsync(distro: string): Promise<string | null> {
  const cachedHome = getCachedWslHome(distro)
  if (cachedHome !== undefined) {
    return Promise.resolve(cachedHome)
  }
  const inflight = wslHomeProbesInFlight.get(distro)
  if (inflight) {
    return inflight
  }

  const [program, ...args] = WSL_HOME_GUEST_ARGV
  const probe = runWslProcess({
    distro,
    program,
    args,
    loginPath: 'none',
    timeoutMs: WSL_HOME_PROBE_TIMEOUT_MS
  })
    .then(
      (result) => (result.code === 0 ? result.stdout : ''),
      () => ''
    )
    .then((stdout) => rememberWslHomeProbe(distro, stdout))
    .finally(() => {
      if (wslHomeProbesInFlight.get(distro) === probe) {
        wslHomeProbesInFlight.delete(distro)
      }
    })
  wslHomeProbesInFlight.set(distro, probe)
  return probe
}

function rememberWslHomeProbe(distro: string, stdout: string): string | null {
  const home = stdout.trim()
  if (!home.startsWith('/')) {
    const streak = (wslHomeProbeFailures.get(distro)?.streak ?? 0) + 1
    wslHomeProbeFailures.set(distro, {
      streak,
      retryAfterMs: Date.now() + wslDistroListRetryDelayMs(streak)
    })
    return null
  }
  wslHomeProbeFailures.delete(distro)
  return rememberWslHome(distro, toWindowsWslPath(home, distro))
}

export function _resetWslHomeProbesForTests(): void {
  clearWslHomeCache()
  wslHomeProbesInFlight.clear()
  wslHomeProbeFailures.clear()
}
