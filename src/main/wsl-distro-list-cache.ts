import { dropStaleWslAvailabilityFailure } from './wsl-availability'
import { filterUserWslDistros } from './wsl-distro-list-output'
import { wslDistroListRetryDelayMs } from './wsl-distro-retry'

let wslDistroCache: string[] | null = null
// Why: a wsl.exe failure must stay retryable (a transient error would
// otherwise hide every distro until restart), but repeated failures cannot
// re-spawn a blocking wsl.exe on every caller; brief negative caching bounds
// the spawn rate on machines where WSL is absent or persistently broken.
// Empty and failed probes back off from 15 seconds to a five-minute cap.
let wslDistroListRetryAfterMs = 0
let wslDistroListEmptyStreak = 0
let wslDistroProbeSequence = 0
let wslDistroCacheSequence = 0

// Why: a missing WSL install never becomes a distro list. Caching the absence stops the 5-minute wsl.exe retry.
let wslInstallationAbsent = false

export function rememberWslInstallationAbsent(): string[] {
  wslInstallationAbsent = true
  wslDistroCache = []
  wslDistroListRetryAfterMs = 0
  return wslDistroCache
}

export function armWslDistroListRetry(): void {
  const now = Date.now()
  // Concurrent completions belong to the retry window already armed by the first result.
  if (now < wslDistroListRetryAfterMs) {
    return
  }
  wslDistroListEmptyStreak += 1
  wslDistroListRetryAfterMs = now + wslDistroListRetryDelayMs(wslDistroListEmptyStreak)
}

// Why: `wsl --install` reports zero distros while one is still provisioning, so an
// empty answer is transient and must stay retryable — caching it for the process
// lifetime is what made WSL vanish from the picker after setup. It is still cached
// for reads, so a missing distro stays visible to `isKnownMissingDistro`.
export function cacheWslDistroList(rawDistros: string[], probeSequence: number): string[] {
  const userDistros = filterUserWslDistros(rawDistros)
  // An older positive result must not replace the newer lifetime-stable list.
  if (
    probeSequence < wslDistroCacheSequence &&
    (userDistros.length === 0 || (wslDistroCache?.length ?? 0) > 0)
  ) {
    return wslDistroCache ?? []
  }
  // Why: probes overlap and can resolve out of order — a slow pre-registration wsl.exe
  // can land after a fast one that already found the distro. A late empty answer must
  // not erase that list, or provisioning reverts to "no distros" and backs off again.
  if (userDistros.length === 0 && wslDistroCache !== null && wslDistroCache.length > 0) {
    return wslDistroCache
  }
  if (userDistros.length > 0) {
    dropStaleWslAvailabilityFailure()
  }
  wslDistroCacheSequence = probeSequence
  wslDistroCache = userDistros
  if (wslDistroCache.length === 0) {
    armWslDistroListRetry()
  }
  return wslDistroCache
}

/** A non-empty list is stable; an empty one re-probes once the retry window elapses. */
export function shouldReuseCachedWslDistros(): boolean {
  return (
    wslDistroCache !== null && (wslDistroCache.length > 0 || Date.now() < wslDistroListRetryAfterMs)
  )
}

// Why: report the last observed answer even once it is stale. An empty list is a real
// probe result, so it must keep driving the `wsl-distro-missing` repair prompt; going
// null instead fails open and silently spawns `wsl.exe -d <distro>` for a distro Dolphin
// last saw was absent. Staleness self-corrects — `listWslDistros` re-probes after the
// retry window and a distro installed since clears the prompt on its own.
export function getCachedWslDistros(): string[] | null {
  return wslDistroCache
}

export function isWslInstallationKnownAbsent(): boolean {
  return wslInstallationAbsent
}

export function isWslDistroListRetryPending(): boolean {
  return Date.now() < wslDistroListRetryAfterMs
}

/** Whether a probe has answered or failed, so sync callers no longer need to block on one. */
export function hasWslDistroListProbed(): boolean {
  return wslDistroCache !== null || wslDistroListEmptyStreak > 0
}

export function nextWslDistroProbeSequence(): number {
  return ++wslDistroProbeSequence
}

/** Off Windows there is no WSL: a confirmed, lifetime-stable empty list. */
export function cacheNoWslDistros(): string[] {
  wslDistroCache = []
  return wslDistroCache
}

export function resetWslDistroListCache(): void {
  wslDistroCache = null
  wslDistroListRetryAfterMs = 0
  wslDistroListEmptyStreak = 0
  wslDistroProbeSequence = 0
  wslDistroCacheSequence = 0
  wslInstallationAbsent = false
}
