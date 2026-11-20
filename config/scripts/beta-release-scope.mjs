#!/usr/bin/env node

// Which apps a beta on `develop` should cut: an app gets one only when something it ships changed
// since its nearest release tag. Writes desktop=true|false and mobile=true|false to GITHUB_OUTPUT.

import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { isDesktopShippedPath } from './pr-code-change-scope.mjs'

// Why rc and stable alike: the last beta already shipped everything up to its tag.
export const RELEASE_TAG_PATTERNS = {
  desktop: { match: 'v*', exclude: [] },
  // Why exclude latest: it is re-pointed at every stable, so it is not a version boundary.
  mobile: { match: 'mobile-android-v*', exclude: ['mobile-android-latest'] }
}

const TEST_DIRS = new Set(['tests', '__tests__', '__fixtures__'])

export function isTestPath(file) {
  const segments = file.split('/')
  return segments.some((segment) => TEST_DIRS.has(segment)) || /\.test\./.test(segments.at(-1))
}

// Why the packaging rule, not "anything outside mobile/": CI, docs and release-pipeline changes
// ship nothing new to desktop users, so they must not cut a desktop beta.
export function isDesktopReleasePath(file) {
  return isDesktopShippedPath(file) && !isTestPath(file)
}

// Why .md counts as docs here: isDocsOnlyPath knows only the root docs, and the app bundles none.
export function isMobileReleasePath(file) {
  return file.startsWith('mobile/') && !file.endsWith('.md') && !isTestPath(file)
}

const DETECTORS = { desktop: isDesktopReleasePath, mobile: isMobileReleasePath }

/** `changedFiles` null means the app has no release tag yet, so it counts as changed. */
export function appNeedsBeta(app, changedFiles) {
  return changedFiles === null || changedFiles.some(DETECTORS[app])
}

/** Dispatch runs name the app; push runs detect it. */
export function scopeForApp(app) {
  if (!['desktop', 'mobile', 'both'].includes(app)) {
    throw new Error(`app must be desktop, mobile or both; got '${app}'`)
  }
  return { desktop: app !== 'mobile', mobile: app !== 'desktop' }
}

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

export function nearestReleaseTag(app, sha, { cwd = process.cwd() } = {}) {
  const { match, exclude } = RELEASE_TAG_PATTERNS[app]
  const args = ['describe', '--tags', '--abbrev=0', '--match', match]
  for (const pattern of exclude) {
    args.push('--exclude', pattern)
  }
  try {
    return git([...args, sha], cwd).trim()
  } catch (error) {
    // Why only these: any other failure (bad sha, shallow clone) must not silently cut a beta.
    if (/No (?:names|tags) (?:found|can describe)/.test(String(error?.stderr ?? ''))) {
      return null
    }
    throw error
  }
}

export function changedFilesSince(tag, sha, { cwd = process.cwd() } = {}) {
  // Why --no-renames: a file moved out of mobile/ must count for both apps.
  const output = git(['diff', '--name-only', '--no-renames', '-z', tag, sha], cwd)
  return output.split('\0').filter(Boolean)
}

export function detectBetaScope(sha, { cwd = process.cwd(), log = console.log } = {}) {
  // Why first: describe reports "No names found" before it resolves the commit.
  git(['rev-parse', '--verify', '--quiet', `${sha}^{commit}`], cwd)
  const scope = {}
  for (const app of Object.keys(DETECTORS)) {
    const tag = nearestReleaseTag(app, sha, { cwd })
    const files = tag === null ? null : changedFilesSince(tag, sha, { cwd })
    scope[app] = appNeedsBeta(app, files)
    const since = tag === null ? 'no release tag yet' : `${files.length} file(s) since ${tag}`
    log(`${app}: ${scope[app] ? 'beta' : 'no beta'} (${since})`)
  }
  return scope
}

function main() {
  const args = process.argv.slice(2)
  const appIndex = args.indexOf('--app')
  let scope
  if (appIndex !== -1) {
    scope = scopeForApp(args[appIndex + 1])
  } else if (args[0] && !args[0].startsWith('--')) {
    scope = detectBetaScope(args[0])
  } else {
    throw new Error('Usage: beta-release-scope.mjs <sha> | --app <desktop|mobile|both>')
  }
  for (const [key, value] of Object.entries(scope)) {
    console.log(`${key}=${value}`)
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`)
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main()
  } catch (error) {
    console.error(`::error::${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}
