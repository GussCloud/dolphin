#!/usr/bin/env node

// A beta records, on its mobile rc release, which TestFlight build it uploaded. A promote of that
// rc hands the same build to external testers instead of compiling the same commit again.
//   write <version> <build-number> <sha> <file>
//   read <file> --version <X.Y.Z> --sha <rc commit>   → build_number=<n>, empty when not reusable

import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const IOS_BUILD_RECORD_ASSET = 'ios-testflight-build.json'
const VERSION = /^\d+\.\d+\.\d+$/
const BUILD_NUMBER = /^[1-9]\d*$/
const FULL_SHA = /^[0-9a-f]{40}$/

export function createIosBuildRecord({ version, buildNumber, sha }) {
  if (!VERSION.test(version ?? '')) {
    throw new Error(`iOS version must be X.Y.Z, got '${version}'`)
  }
  if (!BUILD_NUMBER.test(buildNumber ?? '')) {
    throw new Error(`iOS build number must be a positive integer, got '${buildNumber}'`)
  }
  if (!FULL_SHA.test(sha ?? '')) {
    throw new Error(`Expected a full commit sha, got '${sha}'`)
  }
  return { version, buildNumber, sha }
}

/** `{ buildNumber }` when the record is the build of this version and commit, else `{ reason }`. */
export function reusableIosBuild(recordText, { version, sha }) {
  let record
  try {
    record = createIosBuildRecord(JSON.parse(recordText))
  } catch (error) {
    return { reason: `unreadable record (${error.message})` }
  }
  if (record.version !== version) {
    return { reason: `record is for ${record.version}, not ${version}` }
  }
  if (record.sha !== sha) {
    return { reason: `record is for commit ${record.sha}, not ${sha}` }
  }
  return { buildNumber: record.buildNumber }
}

function option(args, name) {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args[index + 1]
}

function main() {
  const [command, ...args] = process.argv.slice(2)
  if (command === 'write') {
    const [version, buildNumber, sha, file] = args
    const record = createIosBuildRecord({ version, buildNumber, sha })
    writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`)
    console.log(`Recorded iOS ${version} (${buildNumber}) at ${sha}`)
    return
  }
  if (command === 'read') {
    const version = option(args, '--version')
    const sha = option(args, '--sha')
    const result = reusableIosBuild(readFileSync(args[0], 'utf8'), { version, sha })
    console.log(
      result.buildNumber
        ? `The beta uploaded iOS ${version} (${result.buildNumber}) from this commit.`
        : `The beta's iOS build cannot be reused: ${result.reason}.`
    )
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, `build_number=${result.buildNumber ?? ''}\n`)
    }
    return
  }
  throw new Error(
    'Usage: ios-beta-build-record.mjs write <version> <build> <sha> <file> | read <file> --version <v> --sha <sha>'
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main()
  } catch (error) {
    console.error(`::error::${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}
