import { execFile, execFileSync } from 'node:child_process'
import { parseWslUncPath } from '../shared/wsl-paths'
import { filterUserWslDistros, parseWslDistros } from './wsl-distro-list-output'
import {
  _resetWslAvailabilityCacheForTests,
  _setWslAvailabilityCacheForTests
} from './wsl-availability'
import {
  armWslDistroListRetry,
  cacheNoWslDistros,
  cacheWslDistroList,
  getCachedWslDistros,
  hasWslDistroListProbed,
  isWslDistroListRetryPending,
  isWslInstallationKnownAbsent,
  nextWslDistroProbeSequence,
  rememberWslInstallationAbsent,
  resetWslDistroListCache,
  shouldReuseCachedWslDistros
} from './wsl-distro-list-cache'
import { resolveWslInteropSpawnCwd } from './wsl-interop-spawn-directory'
import {
  _resetRunningWslDistroCacheForTests,
  resolveRunningWslDistros
} from './wsl-running-distro-cache'
import {
  getWslDirectoryProbeArgs,
  parseWslDirectoryProbeOutput
} from './wsl-directory-probe-command'
import {
  _resetWslHomeProbesForTests,
  getWslHomeAsync,
  readWslHomeSync,
  WSL_HOME_GUEST_ARGV,
  WSL_HOME_PROBE_TIMEOUT_MS
} from './wsl-home-probe'
import { buildWslExecArgs } from '../shared/wsl-login-shell-command'
import { getCachedWslHome } from './wsl-home-cache'
import {
  _setWslInstallationForTests,
  peekWslInstallation,
  peekWslInstallationAndRefreshIfDue,
  readWslInstallation
} from './wsl-installation'
export { hasCachedWslHome } from './wsl-home-cache'
export { getCachedWslDistros } from './wsl-distro-list-cache'
export { getWslHomeAsync } from './wsl-home-probe'
// Why re-exported rather than defined here: the relay bundle needs the path
// conversion without this module's distro-probing subprocess graph.
export { toLinuxPath, toWindowsWslPath } from '../shared/wsl-paths'
export {
  getCachedWslAvailability,
  hasCachedWslAvailability,
  isWslAvailableAsync
} from './wsl-availability'
export type WslPathInfo = {
  distro: string
  linuxPath: string
}
/** Detect and parse a WSL UNC path on Windows. */
export function parseWslPath(windowsPath: string): WslPathInfo | null {
  if (process.platform !== 'win32') {
    return null
  }

  return parseWslUncPath(windowsPath)
}

export function isWslPath(path: string): boolean {
  return parseWslPath(path) !== null
}

/**
 * Check whether a WSL UNC working directory exists by testing it inside the
 * distro itself, returning null when the answer can't be determined.
 *
 * Why: Win32 fs.statSync against the WSL 9P filesystem (\\wsl.localhost\...)
 * is unreliable for repos that live on the WSL side — it can report ENOENT for
 * directories that exist, which made opening a WSL worktree fail with
 * "Working directory ... does not exist". The guest marker probe asks the
 * distro directly, which is the authoritative answer. Returns null (rather
 * than false) when wsl.exe is unavailable or errors so callers can fall back to
 * the fs check instead of falsely rejecting a valid directory.
 */
export function wslUncDirectoryExists(uncPath: string): boolean | null {
  if (process.platform !== 'win32') {
    return null
  }
  const info = parseWslUncPath(uncPath)
  if (!info) {
    return null
  }
  try {
    const stdout = execFileSync('wsl.exe', getWslDirectoryProbeArgs(info), {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
      encoding: 'utf8',
      // Why: main is a GUI-subsystem process; an unhidden wsl.exe flashes a console that can take focus.
      windowsHide: true,
      cwd: resolveWslInteropSpawnCwd()
    })
    return parseWslDirectoryProbeOutput(stdout)
  } catch {
    return null
  }
}

export function wslUncDirectoryExistsAsync(uncPath: string): Promise<boolean | null> {
  if (process.platform !== 'win32') {
    return Promise.resolve(null)
  }
  const info = parseWslUncPath(uncPath)
  if (!info) {
    return Promise.resolve(null)
  }
  return new Promise((resolve) => {
    const probeOpts = { timeout: 5000, windowsHide: true, cwd: resolveWslInteropSpawnCwd() }
    execFile('wsl.exe', getWslDirectoryProbeArgs(info), probeOpts, (_error, stdout) => {
      // Why: wsl.exe uses numeric exits for both guest results and host failures; only the guest marker is authoritative.
      resolve(parseWslDirectoryProbeOutput(stdout))
    })
  })
}

let wslDistroListInFlight: Promise<string[]> | null = null

export function listWslDistros(): string[] {
  if (isWslInstallationKnownAbsent() || shouldReuseCachedWslDistros()) {
    return getCachedWslDistros() ?? []
  }

  if (process.platform !== 'win32') {
    return cacheNoWslDistros()
  }

  if (isWslDistroListRetryPending()) {
    return getCachedWslDistros() ?? []
  }

  // Why: only a cold cache may block the main thread; once a probe has answered or failed,
  // sync callers keep the last answer and the refresh runs off-thread.
  if (hasWslDistroListProbed()) {
    void listWslDistrosAsync()
    return getCachedWslDistros() ?? []
  }

  const installed = peekWslInstallationAndRefreshIfDue()
  if (installed === 'absent') {
    return rememberWslInstallationAbsent()
  }
  // No registered service key and no sc.exe verdict yet: a sync wsl.exe could open the installer.
  if (installed === null) {
    void listWslDistrosAsync()
    return getCachedWslDistros() ?? []
  }

  try {
    const probeSequence = nextWslDistroProbeSequence()
    const output = execFileSync('wsl.exe', ['--list', '--quiet'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
      windowsHide: true,
      cwd: resolveWslInteropSpawnCwd()
    })
    return cacheWslDistroList(parseWslDistros(output), probeSequence)
  } catch {
    armWslDistroListRetry()
    return getCachedWslDistros() ?? []
  }
}

export async function listWslDistrosAsync(): Promise<string[]> {
  const cached = getCachedWslDistros()
  // A non-empty list is lifetime-stable, so never wait on a probe that cannot improve it.
  if (isWslInstallationKnownAbsent() || (cached !== null && cached.length > 0)) {
    return cached ?? []
  }
  // Why ahead of the negative cache: a synchronous caller can land an empty result and arm
  // the retry window mid-probe, and handing this caller that [] would strand it even though
  // the pending probe is about to see the distro that just finished provisioning.
  if (wslDistroListInFlight) {
    return wslDistroListInFlight
  }

  if (process.platform !== 'win32') {
    return shouldReuseCachedWslDistros() ? (cached ?? []) : cacheNoWslDistros()
  }

  if (shouldReuseCachedWslDistros() || isWslDistroListRetryPending()) {
    return cached ?? []
  }

  // Capability reads, CLI reconciliation and hook startup all ask before the first result
  // lands; one host-wide answer must cost one wsl.exe spawn. `catch` sits ahead of the
  // stored promise, so joiners get the same fail-safe [] a per-caller catch returned.
  const probeSequence = nextWslDistroProbeSequence()
  const listDistros = (): Promise<string[]> =>
    execFileUtf8('wsl.exe', ['--list', '--quiet']).then((output) =>
      cacheWslDistroList(parseWslDistros(output), probeSequence)
    )
  // A known install spawns at once; otherwise the service verdict decides whether wsl.exe may run.
  const probe = (
    peekWslInstallation() === 'present'
      ? listDistros()
      : readWslInstallation().then((installed) =>
          installed === 'absent' ? rememberWslInstallationAbsent() : listDistros()
        )
  )
    .catch(() => {
      armWslDistroListRetry()
      return getCachedWslDistros() ?? []
    })
    .finally(() => {
      // Only the probe that owns the slot may clear it; a test reset can install a newer one.
      if (wslDistroListInFlight === probe) {
        wslDistroListInFlight = null
      }
    })
  wslDistroListInFlight = probe
  return probe
}

/** Running user distros only — see `resolveRunningWslDistros` for the fallback/backoff and
 *  single-flight contract shared by every caller. */
export async function listRunningWslDistrosAsync(
  options: { requireConfirmed?: boolean } = {}
): Promise<string[]> {
  if (process.platform !== 'win32') {
    return []
  }
  // The running-list failure backoff also caps at 5 minutes and would keep launching the installer.
  // Confirmed absence is a confirmed empty list, even under requireConfirmed.
  if (peekWslInstallation() !== 'present' && (await readWslInstallation()) === 'absent') {
    return []
  }
  return resolveRunningWslDistros(
    () =>
      execFileUtf8('wsl.exe', ['--list', '--running', '--quiet'], {
        ...process.env,
        WSL_UTF8: '1'
      }).then((output) => filterUserWslDistros(parseWslDistros(output))),
    options
  )
}

export function hasCachedWslDistros(): boolean {
  return getCachedWslDistros() !== null
}

export function getDefaultWslDistro(): string | null {
  return listWslDistros()[0] ?? null
}

/**
 * Get the home directory for a WSL distro, returned as a Windows UNC path.
 *
 * Why: worktrees for WSL repos are created under ~/dolphin/workspaces inside
 * the WSL filesystem, mirroring the Windows workspace layout. We need the
 * WSL user's $HOME to compute that path.
 */
export function getWslHome(distro: string): string | null {
  // A saved distro on a host without WSL must not reach wsl.exe, before the verdict or after it.
  const installed = process.platform === 'win32' ? peekWslInstallationAndRefreshIfDue() : 'present'
  if (installed === 'absent' || installed === null) {
    return getCachedWslHome(distro) ?? null
  }
  // Why here: the runner is async-only, so the one cold sync probe lives in this allowlisted file.
  return readWslHomeSync(distro, () =>
    execFileSync('wsl.exe', buildWslExecArgs(distro, [...WSL_HOME_GUEST_ARGV]), {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: WSL_HOME_PROBE_TIMEOUT_MS,
      windowsHide: true,
      cwd: resolveWslInteropSpawnCwd()
    })
  )
}

/** UNC home roots for distros that are running at discovery time. */
export async function listRunningWslHomeDirsAsync(): Promise<string[]> {
  const homes = await Promise.all(
    (await listRunningWslDistrosAsync()).map((distro) => getWslHomeAsync(distro))
  )
  return homes.filter((home): home is string => Boolean(home))
}

// Both test entry points retire the pending probe with the cache it would write into;
// leaving it armed would let a retired probe answer the next test.
function resetWslDistroListState(): void {
  resetWslDistroListCache()
  wslDistroListInFlight = null
}

export function _resetWslCachesForTests(): void {
  _resetWslHomeProbesForTests()
  resetWslDistroListState()
  _resetRunningWslDistroCacheForTests()
  _resetWslAvailabilityCacheForTests()
}

// Why: seeded state expires like real state — an `available: false` seed is re-probed
// once its window lapses, and a `distros` seed is filtered and arms the retry window.
// Tests that advance timers past either window must mock child_process.
export function _setWslCachesForTests(args: {
  available?: boolean | null
  distros?: string[] | null
  availabilityRetryable?: boolean
}): void {
  _setWslAvailabilityCacheForTests(args.available, args.availabilityRetryable ?? false)
  // Why: seed through the real cache path so an empty seed arms the retry window
  // too — otherwise a seeded [] lets the next call spawn a real 5s wsl.exe.
  resetWslDistroListState()
  if (args.distros) {
    cacheWslDistroList(args.distros, nextWslDistroProbeSequence())
  }
  // A seeded catalog is an installed host. Don't let the service query consume a wsl.exe mock.
  _setWslInstallationForTests('present')
}

function execFileUtf8(command: string, args: string[], env?: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        encoding: 'utf-8',
        env,
        timeout: 5000,
        windowsHide: true,
        cwd: resolveWslInteropSpawnCwd()
      },
      (error, stdout) => {
        if (error) {
          reject(error)
          return
        }
        resolve(stdout)
      }
    )
  })
}
