#!/usr/bin/env node

import { existsSync } from 'node:fs'

const SIGNING_KEYS = ['CSC_LINK', 'CSC_KEY_PASSWORD']
// Why two sets: electron-builder notarizes with either one (Apple ID first, then API key) and
// silently skips notarization when neither is complete.
const NOTARIZE_APPLE_ID_KEYS = ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID']
const NOTARIZE_API_KEY_KEYS = ['APPLE_API_KEY', 'APPLE_API_KEY_ID', 'APPLE_API_ISSUER']

function isSet(env, key) {
  const value = env[key]
  return typeof value === 'string' && value.trim().length > 0
}

/** Returns the problems that would make a release build ship unsigned or unnotarized. */
export function findMacReleaseEnvProblems(env, fileExists = existsSync) {
  const problems = SIGNING_KEYS.filter((key) => !isSet(env, key)).map((key) => `${key} is not set`)
  const usesAppleId = NOTARIZE_APPLE_ID_KEYS.some((key) => isSet(env, key))
  const notarizeKeys = usesAppleId ? NOTARIZE_APPLE_ID_KEYS : NOTARIZE_API_KEY_KEYS
  problems.push(...notarizeKeys.filter((key) => !isSet(env, key)).map((key) => `${key} is not set`))
  // Why: notarytool takes the API key as a file path; a pasted key value fails only after signing.
  if (!usesAppleId && isSet(env, 'APPLE_API_KEY') && !fileExists(env.APPLE_API_KEY)) {
    problems.push('APPLE_API_KEY must be the path to an existing .p8 file')
  }
  return problems
}

if (process.argv[1] === import.meta.filename) {
  const problems = findMacReleaseEnvProblems(process.env)
  if (problems.length > 0) {
    // Why: local developers still need ad-hoc builds for validation, but the
    // production release path must fail fast instead of silently shipping an
    // unsigned, unnotarized app that only looked successful in CI logs.
    console.error('Invalid macOS release signing environment:')
    for (const problem of problems) {
      console.error(`- ${problem}`)
    }
    console.error('')
    console.error('Use `pnpm build:mac` for local ad-hoc builds, or provide CSC_LINK and')
    console.error('CSC_KEY_PASSWORD plus either APPLE_ID/APPLE_APP_SPECIFIC_PASSWORD/APPLE_TEAM_ID')
    console.error('or APPLE_API_KEY (.p8 path)/APPLE_API_KEY_ID/APPLE_API_ISSUER.')
    process.exit(1)
  }
}
