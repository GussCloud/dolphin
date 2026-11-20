import { describe, expect, it, vi } from 'vitest'
import {
  findLandingPullRequest,
  isCommitOnBranch,
  requiredCheckVerdict,
  verifyReleaseCommit
} from './verify-release-commit.mjs'

function jsonResponse(body) {
  return { ok: true, status: 200, statusText: 'OK', json: async () => body, text: async () => '' }
}

describe('isCommitOnBranch', () => {
  it('accepts commits the branch contains', () => {
    expect(isCommitOnBranch({ status: 'identical' })).toBe(true)
    expect(isCommitOnBranch({ status: 'ahead' })).toBe(true)
    expect(isCommitOnBranch({ status: 'behind' })).toBe(false)
    expect(isCommitOnBranch({ status: 'diverged' })).toBe(false)
  })
})

describe('findLandingPullRequest', () => {
  it('matches the merged PR by merge commit or merged head', () => {
    const pulls = [
      { number: 1, merged_at: null, merge_commit_sha: 'abc', head: { sha: 'h1' } },
      { number: 2, merged_at: '2026-11-01', merge_commit_sha: 'abc', head: { sha: 'h2' } }
    ]
    expect(findLandingPullRequest(pulls, 'abc')?.number).toBe(2)
    expect(findLandingPullRequest(pulls, 'h2')?.number).toBe(2)
    expect(findLandingPullRequest(pulls, 'zzz')).toBeNull()
  })
})

describe('requiredCheckVerdict', () => {
  it('uses the newest run so a passing rerun supersedes a failure', () => {
    const runs = [
      { id: 1, name: 'verify', status: 'completed', conclusion: 'failure' },
      { id: 2, name: 'verify', status: 'completed', conclusion: 'success' }
    ]
    expect(requiredCheckVerdict(runs).ok).toBe(true)
    expect(
      requiredCheckVerdict([...runs, { id: 3, name: 'verify', status: 'in_progress' }])
    ).toEqual({ ok: false, reason: "'verify' is still in_progress" })
    expect(
      requiredCheckVerdict([{ id: 1, name: 'verify', status: 'completed', conclusion: 'skipped' }])
        .ok
    ).toBe(false)
    expect(requiredCheckVerdict([]).reason).toMatch(/no 'verify'/)
  })
})

describe('verifyReleaseCommit', () => {
  it('checks main containment, then the landing PR checks', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status: 'ahead' }))
      .mockResolvedValueOnce(
        jsonResponse([
          { number: 9, merged_at: 'x', merge_commit_sha: 'abc', head: { sha: 'head9' } }
        ])
      )
      .mockResolvedValueOnce(
        jsonResponse({
          check_runs: [{ id: 5, name: 'verify', status: 'completed', conclusion: 'success' }]
        })
      )
    const { pull } = await verifyReleaseCommit({
      repo: 'o/r',
      sha: 'abc',
      token: 't',
      requireChecks: true,
      fetchImpl,
      log: vi.fn()
    })
    expect(pull.number).toBe(9)
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      'https://api.github.com/repos/o/r/compare/abc...main',
      'https://api.github.com/repos/o/r/commits/abc/pulls',
      'https://api.github.com/repos/o/r/commits/head9/check-runs?check_name=verify&per_page=100'
    ])
  })

  it('refuses a commit that is not on main', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse({ status: 'diverged' }))
    await expect(
      verifyReleaseCommit({ repo: 'o/r', sha: 'abc', token: 't', fetchImpl, log: vi.fn() })
    ).rejects.toThrow(/not on main/)
  })

  it('refuses a commit no merged PR landed', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status: 'identical' }))
      .mockResolvedValueOnce(jsonResponse([]))
    await expect(
      verifyReleaseCommit({
        repo: 'o/r',
        sha: 'abc',
        token: 't',
        requireChecks: true,
        fetchImpl,
        log: vi.fn()
      })
    ).rejects.toThrow(/not landed by a merged pull request/)
  })
})
