import { WHATS_NEW_RELEASES, type WhatsNewRelease } from './whats-new-releases'

export type WhatsNewDecision =
  | { kind: 'show'; release: WhatsNewRelease }
  | { kind: 'record'; version: string }
  | { kind: 'skip' }

function parseVersion(version: string): [number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version.trim())
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null
}

/** Compares major.minor.patch only; prerelease suffixes are ignored. Unparseable input sorts lowest. */
export function compareReleaseVersions(a: string, b: string): number {
  const left = parseVersion(a)
  const right = parseVersion(b)
  if (!left || !right) {
    return left ? 1 : right ? -1 : 0
  }
  for (let i = 0; i < 3; i += 1) {
    if (left[i] !== right[i]) {
      return left[i] < right[i] ? -1 : 1
    }
  }
  return 0
}

export function getWhatsNewDecision(args: {
  appVersion: string | null
  lastSeenVersion: string | undefined
  /** True while first-run onboarding is, or is about to be, on screen. */
  onboardingVisible: boolean
  releases?: readonly WhatsNewRelease[]
}): WhatsNewDecision {
  const { appVersion, lastSeenVersion, onboardingVisible, releases = WHATS_NEW_RELEASES } = args
  if (appVersion === null || parseVersion(appVersion) === null) {
    return { kind: 'skip' }
  }
  const release = releases
    .filter(
      (entry) =>
        compareReleaseVersions(entry.version, appVersion) <= 0 &&
        (lastSeenVersion === undefined ||
          compareReleaseVersions(entry.version, lastSeenVersion) > 0)
    )
    .sort((a, b) => compareReleaseVersions(b.version, a.version))[0]
  if (!release) {
    return { kind: 'skip' }
  }
  // Why: an undefined lastSeen also describes upgraders, so only live onboarding marks a fresh install.
  if (onboardingVisible) {
    return { kind: 'record', version: appVersion }
  }
  return { kind: 'show', release }
}
