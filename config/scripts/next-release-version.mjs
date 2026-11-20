#!/usr/bin/env node

import { appendFileSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { fetchReleases, latestStableDesktopReleaseTag } from './latest-stable-release.mjs'
import { highestRcForBase, rcNumberFromTag } from './release-rc-history.mjs'

const BUMP_LEVELS = ['patch', 'minor', 'major']
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/
const RC_TAG = /^v(\d+\.\d+\.\d+)-rc\.(\d+)$/

// Release lines differ only by tag prefix: desktop `v1.2.3`, mobile `mobile-android-v1.2.3`.
export const RELEASE_LINES = {
  desktop: { tagPrefix: '' },
  mobile: { tagPrefix: 'mobile-android-' }
}

function parseSemver(version) {
  const match = SEMVER.exec(version)
  return match ? match.slice(1).map(Number) : null
}

function compareSemver(a, b) {
  const [left, right] = [parseSemver(a), parseSemver(b)]
  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2]
}

export function bumpVersion(version, level) {
  const parts = parseSemver(version)
  if (!parts) {
    throw new Error(`Cannot bump non-semver version '${version}'`)
  }
  if (!BUMP_LEVELS.includes(level)) {
    throw new Error(`bump must be one of ${BUMP_LEVELS.join(', ')}; got '${level}'`)
  }
  const [major, minor, patch] = parts
  if (level === 'major') {
    return `${major + 1}.0.0`
  }
  return level === 'minor' ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`
}

function stripLinePrefix(tag, tagPrefix) {
  return tag.startsWith(tagPrefix) ? tag.slice(tagPrefix.length) : null
}

/** Every rc tag of a line, as `{ base, rc }`, from tag names (releases, drafts included, or git). */
export function rcTagsOfLine(tagNames, tagPrefix) {
  return tagNames
    .map((name) => stripLinePrefix(name, tagPrefix))
    .map((tag) => (tag ? RC_TAG.exec(tag) : null))
    .filter(Boolean)
    .map((match) => ({
      base: match[1],
      rc: rcNumberFromTag(match[1], `v${match[1]}-rc.${match[2]}`)
    }))
}

export function stableVersionsOfLine(releases, tagPrefix) {
  return releases
    .filter((release) => release?.draft !== true)
    .map((release) => stripLinePrefix(release?.tag_name ?? '', tagPrefix))
    .map((tag) => (tag ? /^v(\d+\.\d+\.\d+)$/.exec(tag)?.[1] : null))
    .filter(Boolean)
}

/**
 * The next beta of a line: bump the last stable, then continue that base's rc counter.
 * Why an unpromoted higher rc base wins: rc users only move to semver-newer builds, so a
 * patch beta cut after a minor beta must stay on the minor line or they never receive it.
 */
export function nextBetaVersion({
  latestStable,
  bump = 'patch',
  rcTags,
  gitHighestRc = () => null
}) {
  let base = bumpVersion(latestStable, bump)
  const openBases = rcTags
    .map(({ base: rcBase }) => rcBase)
    .filter((rcBase) => compareSemver(rcBase, latestStable) > 0)
  for (const rcBase of openBases) {
    if (compareSemver(rcBase, base) > 0) {
      base = rcBase
    }
  }
  const seen = rcTags.filter((entry) => entry.base === base).map((entry) => entry.rc)
  const fromGit = gitHighestRc(base)
  if (fromGit !== null) {
    seen.push(fromGit)
  }
  const rc = seen.length === 0 ? 1 : Math.max(...seen) + 1
  return { base, rc, version: `${base}-rc.${rc}` }
}

/** The stable version a published rc tag promotes to. */
export function promotedVersionFromRcTag(tag, tagPrefix) {
  const match = RC_TAG.exec(stripLinePrefix(tag, tagPrefix) ?? '')
  if (!match) {
    throw new Error(`'${tag}' is not an rc tag of the form ${tagPrefix}vX.Y.Z-rc.N`)
  }
  return match[1]
}

/** The newest published rc tag of a line, for promote runs that name none. */
export function latestRcTag(releases, tagPrefix) {
  const published = releases
    .filter((release) => release?.draft !== true)
    .map((release) => release?.tag_name ?? '')
  const rcs = rcTagsOfLine(published, tagPrefix)
  rcs.sort((a, b) => compareSemver(a.base, b.base) || a.rc - b.rc)
  const newest = rcs.at(-1)
  return newest ? `${tagPrefix}v${newest.base}-rc.${newest.rc}` : ''
}

/**
 * Android versionCode derived from the version alone, so no commit has to carry it.
 * Why this layout: it rises with semver, a stable (slot 99) outranks all of its rcs, and
 * major < 210 keeps it under Play's 2100000000 ceiling.
 */
export function androidVersionCode(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-rc\.(\d+))?$/.exec(version)
  if (!match) {
    throw new Error(`Cannot derive an Android versionCode from '${version}'`)
  }
  const [major, minor, patch] = match.slice(1, 4).map(Number)
  const rc = match[4] === undefined ? 99 : Number(match[4])
  const rcOutOfRange = match[4] !== undefined && (rc < 1 || rc > 98)
  if (minor > 99 || patch > 999 || rcOutOfRange || major > 209) {
    throw new Error(`Version '${version}' is outside the Android versionCode layout`)
  }
  return major * 10_000_000 + minor * 100_000 + patch * 100 + rc
}

function parseArgs(argv) {
  const [line, ...rest] = argv
  const options = { line, bump: 'patch', promote: null, appConfig: 'mobile/app.json' }
  for (let index = 0; index < rest.length; index += 1) {
    const [key, inline] = rest[index].split('=', 2)
    const value = inline ?? rest[++index]
    if (key === '--bump') {
      options.bump = value
    } else if (key === '--promote') {
      options.promote = value
    } else if (key === '--app-config') {
      options.appConfig = value
    } else {
      throw new Error(`Unknown argument ${key}`)
    }
  }
  if (!RELEASE_LINES[line]) {
    throw new Error(
      'Usage: next-release-version.mjs <desktop|mobile> [--bump patch|minor|major] [--promote <rc-tag>|latest]'
    )
  }
  return options
}

export function resolveRelease({ line, bump, promote, releases, mobileAppVersion, gitHighestRc }) {
  const { tagPrefix } = RELEASE_LINES[line]
  const tagNames = releases.map((release) => release?.tag_name ?? '')
  const existing = new Set(tagNames)
  const stables = stableVersionsOfLine(releases, tagPrefix)
  if (line === 'mobile' && mobileAppVersion) {
    stables.push(mobileAppVersion)
  }
  const latestStable =
    line === 'desktop'
      ? latestStableDesktopReleaseTag(releases).replace(/^v/, '')
      : stables.sort(compareSemver).at(-1)
  let version
  let rcTag = ''
  if (promote) {
    rcTag = promote === 'latest' ? latestRcTag(releases, tagPrefix) : promote
    if (!rcTag) {
      throw new Error(`No published ${line} rc release to promote`)
    }
    const release = releases.find((candidate) => candidate?.tag_name === rcTag)
    if (!release || release.draft === true) {
      throw new Error(`${rcTag} is not a published release`)
    }
    version = promotedVersionFromRcTag(rcTag, tagPrefix)
    // Why: the updater only offers stable users a semver-newer build, so an older one strands them.
    if (latestStable && compareSemver(version, latestStable) <= 0) {
      throw new Error(
        `${version} is not newer than the latest stable ${line} release ${latestStable}`
      )
    }
  } else {
    if (!latestStable) {
      throw new Error(`No stable ${line} release to base the beta on`)
    }
    version = nextBetaVersion({
      latestStable,
      bump,
      rcTags: rcTagsOfLine(tagNames, tagPrefix),
      gitHighestRc: line === 'desktop' ? gitHighestRc : () => null
    }).version
  }
  const tag = `${tagPrefix}v${version}`
  if (existing.has(tag)) {
    throw new Error(`Release ${tag} already exists`)
  }
  const result = { version, tag, rc_tag: rcTag, prerelease: String(version.includes('-')) }
  if (line === 'mobile') {
    // Why the bare version: iOS CFBundleShortVersionString and the prepare script take x.y.z only.
    result.marketing_version = version.replace(/-rc\.\d+$/, '')
    result.android_version_code = String(androidVersionCode(version))
  }
  return result
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
  const repo = process.env.GITHUB_REPOSITORY || 'GussCloud/dolphin'
  const releases = await fetchReleases(repo, token)
  const mobileAppVersion =
    options.line === 'mobile'
      ? JSON.parse(readFileSync(options.appConfig, 'utf8')).expo.version
      : null
  const result = resolveRelease({
    ...options,
    releases,
    mobileAppVersion,
    gitHighestRc: (base) => highestRcForBase(base)
  })
  for (const [key, value] of Object.entries(result)) {
    console.log(`${key}=${value}`)
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`)
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
