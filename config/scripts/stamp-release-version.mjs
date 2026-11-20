#!/usr/bin/env node

// Writes a release version into the CI checkout only; the change is never committed, which is
// what lets release workflows version a build without a bump commit on main.

import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const DESKTOP_VERSION = /^\d+\.\d+\.\d+(-rc\.\d+)?$/
const MOBILE_VERSION = /^\d+\.\d+\.\d+$/

function rewriteJson(path, update) {
  const original = readFileSync(path, 'utf8')
  const indent = /^[ \t]+(?=")/m.exec(original)?.[0] ?? '  '
  const next = update(JSON.parse(original))
  writeFileSync(path, `${JSON.stringify(next, null, indent)}\n`)
}

export function stampDesktopVersion(packageJsonPath, version) {
  if (!DESKTOP_VERSION.test(version)) {
    throw new Error(`Desktop release version '${version}' must be X.Y.Z or X.Y.Z-rc.N`)
  }
  rewriteJson(packageJsonPath, (pkg) => ({ ...pkg, version }))
}

export function stampMobileVersion(appConfigPath, version, androidVersionCode) {
  if (!MOBILE_VERSION.test(version)) {
    throw new Error(`Mobile release version '${version}' must be X.Y.Z`)
  }
  const code = Number(androidVersionCode)
  if (!Number.isSafeInteger(code) || code <= 0) {
    throw new Error(`Android versionCode '${androidVersionCode}' must be a positive integer`)
  }
  rewriteJson(appConfigPath, (config) => {
    const committedCode = Number(config.expo?.android?.versionCode)
    // Why: Android refuses to install a lower versionCode over a higher one.
    if (Number.isSafeInteger(committedCode) && code < committedCode) {
      throw new Error(`Android versionCode ${code} is below the committed ${committedCode}`)
    }
    return {
      ...config,
      expo: {
        ...config.expo,
        version,
        android: { ...config.expo.android, versionCode: code }
      }
    }
  })
}

function main() {
  const [target, version, extra] = process.argv.slice(2)
  if (target === 'desktop') {
    stampDesktopVersion(extra || 'package.json', version)
  } else if (target === 'mobile') {
    stampMobileVersion(process.env.MOBILE_APP_CONFIG_PATH || 'app.json', version, extra)
  } else {
    throw new Error(
      'Usage: stamp-release-version.mjs desktop <version> [package.json] | mobile <version> <android-version-code>'
    )
  }
  console.log(`Stamped ${target} release version ${version}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
