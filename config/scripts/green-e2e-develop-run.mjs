#!/usr/bin/env node

// Finds the E2E develop run that already passed the whole suite on a commit, so a promote of that
// commit does not run the same suite a second time. Writes url=<run url>, empty when there is none.

import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

// Written by e2e-develop.yml's `record` job, only after the suite and the WSL lane both passed.
export const GREEN_ARTIFACT = 'e2e-develop-green'
const RUNS_TO_SEARCH = 20
const FULL_SHA = /^[0-9a-f]{40}$/

/**
 * The newest successful run whose record names `sha`. `readGreenSha(run)` returns the commit the
 * run recorded, or null when it recorded none (a schedule that found develop unchanged).
 */
export function findGreenRun(sha, runs, readGreenSha) {
  if (!FULL_SHA.test(sha ?? '')) {
    throw new Error(`Expected a full commit sha, got '${sha}'`)
  }
  for (const run of runs ?? []) {
    // Why the record and not headSha: a scheduled run's headSha is main's, not what it tested.
    if (run?.conclusion === 'success' && readGreenSha(run) === sha) {
      return run
    }
  }
  return null
}

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

function readGreenShaFromArtifact(repo, run) {
  const dir = mkdtempSync(join(tmpdir(), 'e2e-green-'))
  try {
    gh(['run', 'download', String(run.databaseId), '-R', repo, '-n', GREEN_ARTIFACT, '-D', dir])
    return readFileSync(join(dir, 'sha'), 'utf8').trim()
  } catch {
    return null
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function main() {
  const sha = process.argv[2]
  const repo = process.env.GITHUB_REPOSITORY || 'GussCloud/dolphin'
  let url = ''
  try {
    const runs = JSON.parse(
      gh([
        'run',
        'list',
        '-R',
        repo,
        '--workflow',
        'e2e-develop.yml',
        '--status',
        'success',
        '--limit',
        String(RUNS_TO_SEARCH),
        '--json',
        'databaseId,conclusion,url'
      ])
    )
    url = findGreenRun(sha, runs, (run) => readGreenShaFromArtifact(repo, run))?.url ?? ''
  } catch (error) {
    // Why not fatal: without a proven run the promote simply runs the suite itself.
    console.log(`::warning::Could not look up E2E develop runs: ${error?.message ?? error}`)
  }
  console.log(
    url ? `E2E develop already passed on ${sha}: ${url}` : `No green E2E develop run for ${sha}.`
  )
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `url=${url}\n`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
