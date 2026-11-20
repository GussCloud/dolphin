#!/usr/bin/env node

// Gate for release workflows: the commit must be on main, and (for promote) the pull request
// that landed it must have a passing PR Checks aggregate.

import { pathToFileURL } from 'node:url'

const API_VERSION = '2022-11-28'
// Why `verify`: it is pr.yml's aggregate job, the one check that covers every other PR gate.
export const DEFAULT_REQUIRED_CHECK = 'verify'
const PASSING_CONCLUSIONS = new Set(['success'])

async function githubJson(fetchImpl, url, token) {
  const res = await fetchImpl(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': API_VERSION
    }
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GitHub request failed ${res.status} ${res.statusText}: ${body.slice(0, 300)}`)
  }
  return res.json()
}

/** `compare/<sha>...<branch>`: identical or ahead means the branch already contains the commit. */
export function isCommitOnBranch(comparison) {
  return comparison?.status === 'identical' || comparison?.status === 'ahead'
}

/** The merged pull request whose merge produced `sha`, or whose merged head is `sha`. */
export function findLandingPullRequest(pulls, sha) {
  return (
    (pulls ?? []).find(
      (pull) => pull?.merged_at && (pull.merge_commit_sha === sha || pull.head?.sha === sha)
    ) ?? null
  )
}

/** Verdict of the newest run of `checkName`; reruns supersede earlier attempts. */
export function requiredCheckVerdict(checkRuns, checkName = DEFAULT_REQUIRED_CHECK) {
  const runs = (checkRuns ?? []).filter((run) => run?.name === checkName)
  if (runs.length === 0) {
    return { ok: false, reason: `no '${checkName}' check run found` }
  }
  const newest = runs.reduce((latest, run) => (run.id > latest.id ? run : latest))
  if (newest.status !== 'completed') {
    return { ok: false, reason: `'${checkName}' is still ${newest.status}` }
  }
  if (!PASSING_CONCLUSIONS.has(newest.conclusion)) {
    return { ok: false, reason: `'${checkName}' concluded ${newest.conclusion}` }
  }
  return { ok: true, reason: `'${checkName}' passed (${newest.html_url ?? newest.id})` }
}

export async function verifyReleaseCommit({
  repo,
  sha,
  token,
  branch = 'main',
  requireChecks = false,
  checkName = DEFAULT_REQUIRED_CHECK,
  fetchImpl = fetch,
  log = console.log
}) {
  if (!repo || !sha || !token) {
    throw new Error('repo, sha and token are required')
  }
  const api = `https://api.github.com/repos/${repo}`
  const comparison = await githubJson(fetchImpl, `${api}/compare/${sha}...${branch}`, token)
  if (!isCommitOnBranch(comparison)) {
    throw new Error(`${sha} is not on ${branch} (compare status: ${comparison?.status})`)
  }
  log(`${sha} is on ${branch}.`)
  if (!requireChecks) {
    return { pull: null }
  }
  const pulls = await githubJson(fetchImpl, `${api}/commits/${sha}/pulls`, token)
  const pull = findLandingPullRequest(pulls, sha)
  if (!pull) {
    throw new Error(`${sha} was not landed by a merged pull request, so it has no PR checks`)
  }
  const checks = await githubJson(
    fetchImpl,
    `${api}/commits/${pull.head.sha}/check-runs?check_name=${encodeURIComponent(checkName)}&per_page=100`,
    token
  )
  const verdict = requiredCheckVerdict(checks?.check_runs, checkName)
  if (!verdict.ok) {
    throw new Error(`PR #${pull.number} checks did not pass: ${verdict.reason}`)
  }
  log(`PR #${pull.number}: ${verdict.reason}.`)
  return { pull }
}

async function main() {
  const args = process.argv.slice(2)
  const sha = args.find((arg) => !arg.startsWith('--'))
  if (!sha) {
    throw new Error('Usage: verify-release-commit.mjs <sha> [--require-checks]')
  }
  await verifyReleaseCommit({
    repo: process.env.GITHUB_REPOSITORY || 'GussCloud/dolphin',
    sha,
    token: process.env.GH_TOKEN || process.env.GITHUB_TOKEN,
    requireChecks: args.includes('--require-checks')
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`::error::${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  })
}
