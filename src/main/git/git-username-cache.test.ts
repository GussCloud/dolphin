import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as RunnerModule from './runner'

const gitExecFileAsyncMock = vi.hoisted(() => vi.fn())
const ghExecFileAsyncMock = vi.hoisted(() => vi.fn())

vi.mock('./runner', async () => {
  const actual = await vi.importActual<typeof RunnerModule>('./runner')
  return {
    ...actual,
    gitExecFileAsync: gitExecFileAsyncMock,
    ghExecFileAsync: ghExecFileAsyncMock
  }
})

import {
  resetGhLoginCacheForTests,
  resolveLocalGitUsername,
  resolveLocalGitUsernameDetailed,
  warmLocalGitUsername
} from './git-username'

const PREWARM_REVALIDATE_AFTER_MS = 30_000
const READ_REVALIDATE_AFTER_MS = 10 * 60_000

function missing(message: string): Error {
  return Object.assign(new Error(message), { stdout: '', stderr: '' })
}

function gitCallCount(): number {
  return gitExecFileAsyncMock.mock.calls.length
}

describe('resolveLocalGitUsername cache and concurrency', () => {
  let gitConfig: Record<string, string>
  let remoteUrls: Record<string, string>
  let currentBranch: string
  let originHead: string | undefined
  // Per-command delay so tests can make later-ordered probes settle first.
  let delayMs: (args: string[]) => number

  beforeEach(() => {
    vi.resetAllMocks()
    resetGhLoginCacheForTests()
    gitConfig = {}
    remoteUrls = {}
    currentBranch = ''
    originHead = undefined
    delayMs = () => 0

    gitExecFileAsyncMock.mockImplementation(async (args: string[]) => {
      const delay = delayMs(args)
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
      if (args[0] === 'config' && args[1] === '--get') {
        const value = gitConfig[args[2]]
        if (value !== undefined) {
          return { stdout: `${value}\n`, stderr: '' }
        }
        throw missing(`missing config ${args[2]}`)
      }
      if (args[0] === 'remote' && args.length === 1) {
        return { stdout: `${Object.keys(remoteUrls).join('\n')}\n`, stderr: '' }
      }
      if (args[0] === 'remote' && args[1] === 'get-url') {
        const url = remoteUrls[args[2]]
        if (url) {
          return { stdout: `${url}\n`, stderr: '' }
        }
        throw missing(`missing ${args[2]} remote`)
      }
      if (args[0] === 'branch' && args[1] === '--show-current') {
        return { stdout: `${currentBranch}\n`, stderr: '' }
      }
      if (args[0] === 'symbolic-ref' && originHead) {
        return { stdout: `${originHead}\n`, stderr: '' }
      }
      if (args[0] === 'rev-parse' && originHead && args.at(-1)?.endsWith(originHead)) {
        return { stdout: 'abc\n', stderr: '' }
      }
      throw missing(`unhandled ${args.join(' ')}`)
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('serves a cached username without git calls, revalidating only once very stale', async () => {
    vi.useFakeTimers()
    gitConfig['github.user'] = 'cached-demo'
    await expect(resolveLocalGitUsername('/repo')).resolves.toBe('cached-demo')
    const coldCalls = gitCallCount()

    // A create read past the prewarm window must not compete with the create's own git.
    vi.advanceTimersByTime(PREWARM_REVALIDATE_AFTER_MS)
    gitConfig['github.user'] = 'changed-demo'
    await expect(resolveLocalGitUsername('/repo')).resolves.toBe('cached-demo')
    expect(gitCallCount()).toBe(coldCalls)

    vi.advanceTimersByTime(READ_REVALIDATE_AFTER_MS)
    // Stale hit still answers from the cache; the revalidation runs behind it.
    await expect(resolveLocalGitUsername('/repo')).resolves.toBe('cached-demo')
    expect(gitCallCount()).toBeGreaterThan(coldCalls)
    await vi.runAllTimersAsync()
    await expect(resolveLocalGitUsername('/repo')).resolves.toBe('changed-demo')
  })

  it('lets the prewarm pick up a changed config after the short window', async () => {
    vi.useFakeTimers()
    gitConfig['user.username'] = 'old-demo'
    await expect(resolveLocalGitUsername('/repo')).resolves.toBe('old-demo')
    const coldCalls = gitCallCount()

    delete gitConfig['user.username']
    warmLocalGitUsername('/repo')
    expect(gitCallCount()).toBe(coldCalls)

    vi.advanceTimersByTime(PREWARM_REVALIDATE_AFTER_MS)
    warmLocalGitUsername('/repo')
    await vi.runAllTimersAsync()
    expect(gitCallCount()).toBeGreaterThan(coldCalls)
    await expect(resolveLocalGitUsernameDetailed('/repo')).resolves.toEqual({
      username: '',
      authoritative: true
    })
  })

  it('keys the cache per repo path', async () => {
    gitConfig['github.user'] = 'first-demo'
    await expect(resolveLocalGitUsername('/repo-a')).resolves.toBe('first-demo')
    gitConfig['github.user'] = 'second-demo'
    await expect(resolveLocalGitUsername('/repo-b')).resolves.toBe('second-demo')
    await expect(resolveLocalGitUsername('/repo-a')).resolves.toBe('first-demo')
  })

  it('dedupes concurrent cold resolutions for the same repo', async () => {
    gitConfig['github.user'] = 'demo'
    const results = await Promise.all([
      resolveLocalGitUsername('/repo'),
      resolveLocalGitUsername('/repo'),
      resolveLocalGitUsernameDetailed('/repo')
    ])
    expect(results).toEqual(['demo', 'demo', { username: 'demo', authoritative: true }])
    const githubUserReads = gitExecFileAsyncMock.mock.calls.filter(
      ([args]) => args[2] === 'github.user'
    )
    expect(githubUserReads).toHaveLength(1)
  })

  it('warms the cache so the next call needs no git', async () => {
    gitConfig['github.user'] = 'warm-demo'
    warmLocalGitUsername('/repo')
    await expect(resolveLocalGitUsername('/repo')).resolves.toBe('warm-demo')
    const warmedCalls = gitCallCount()
    await expect(resolveLocalGitUsername('/repo')).resolves.toBe('warm-demo')
    expect(gitCallCount()).toBe(warmedCalls)
  })

  it('keeps github.user precedence when user.username answers first', async () => {
    vi.useFakeTimers()
    gitConfig['github.user'] = 'github-demo'
    gitConfig['user.username'] = 'username-demo'
    delayMs = (args) => (args[2] === 'github.user' ? 50 : 0)

    const resolution = resolveLocalGitUsername('/repo')
    await vi.runAllTimersAsync()
    await expect(resolution).resolves.toBe('github-demo')
  })

  it('does not cache a timed-out gh probe as authoritative', async () => {
    remoteUrls.origin = 'https://github.com/gusscloud/dolphin.git'
    ghExecFileAsyncMock.mockRejectedValueOnce(
      Object.assign(new Error('gh timeout'), { code: 'ETIMEDOUT', stdout: '', stderr: '' })
    )

    await expect(resolveLocalGitUsernameDetailed('/repo')).resolves.toEqual({
      username: '',
      authoritative: false
    })
    const afterTimeout = gitCallCount()
    // A cache hit would skip git; a non-authoritative result must re-resolve.
    await resolveLocalGitUsernameDetailed('/repo')
    expect(gitCallCount()).toBeGreaterThan(afterTimeout)
  })

  it('authorizes gh through the current-branch remote even when origin is GitLab', async () => {
    remoteUrls.origin = 'https://gitlab.com/gusscloud/dolphin.git'
    remoteUrls.hub = 'https://github.com/gusscloud/dolphin.git'
    currentBranch = 'feature'
    gitConfig['branch.feature.remote'] = 'hub'
    // The GitLab origin answers first; the decision must not depend on settle order.
    delayMs = (args) => (args[1] === 'get-url' && args[2] === 'hub' ? 20 : 0)
    ghExecFileAsyncMock.mockResolvedValueOnce({ stdout: 'gh-demo\n', stderr: '' })

    await expect(resolveLocalGitUsername('/repo')).resolves.toBe('gh-demo')
  })

  it('reads the default-branch remote from the resolved default base ref', async () => {
    remoteUrls.origin = 'https://gitlab.com/gusscloud/dolphin.git'
    remoteUrls.hub = 'https://github.com/gusscloud/dolphin.git'
    originHead = 'refs/remotes/origin/main'
    gitConfig['branch.main.remote'] = 'hub'
    ghExecFileAsyncMock.mockResolvedValueOnce({ stdout: 'gh-demo\n', stderr: '' })

    await expect(resolveLocalGitUsername('/repo')).resolves.toBe('gh-demo')
  })
})
