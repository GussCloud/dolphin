// Local base ref fast-forward runs off the create's critical path, serialized per repo.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { gitExecFileAsyncMock } = vi.hoisted(() => ({ gitExecFileAsyncMock: vi.fn() }))

vi.mock('./runner', () => ({
  gitExecFileAsync: gitExecFileAsyncMock,
  translateWslOutputPaths: (output: string) => output
}))

vi.mock('./status', () => ({
  runWithGitReadCacheInvalidation: <T>(run: () => Promise<T>) => run()
}))

import {
  _awaitPendingLocalBaseRefRefreshesForTests,
  refreshLocalBaseRefForWorktreeCreate
} from './worktree-base-refresh'

type GitResult = { stdout: string }

function deferred(): {
  promise: Promise<GitResult>
  resolve: () => void
  reject: (error: Error) => void
} {
  let resolve: () => void = () => {}
  let reject: (error: Error) => void = () => {}
  const promise = new Promise<GitResult>((res, rej) => {
    resolve = () => res({ stdout: '' })
    reject = rej
  })
  return { promise, resolve, reject }
}

// Answers the evaluation probes for `main` checked out (clean) in the repo's primary checkout.
function mockGit(onMutation: (args: string[], cwd: string) => Promise<GitResult>): void {
  gitExecFileAsyncMock.mockImplementation((args: string[], options: { cwd: string }) => {
    switch (args[0]) {
      case 'rev-list':
        return Promise.resolve({ stdout: '0\t3\n' })
      case 'rev-parse':
        return Promise.resolve({
          stdout: String(args[2]).startsWith('refs/heads/') ? 'old-main\n' : 'remote-main\n'
        })
      case 'worktree':
        return Promise.resolve({
          stdout: `worktree ${options.cwd}\nHEAD abc\nbranch refs/heads/main\n`
        })
      case 'merge-base':
      case 'status':
        return Promise.resolve({ stdout: '' })
      default:
        return onMutation(args, options.cwd)
    }
  })
}

const refresh = (repoPath: string, options = {}) =>
  refreshLocalBaseRefForWorktreeCreate(
    repoPath,
    'origin/main',
    'refs/remotes/origin/main',
    undefined,
    options
  )

const callsOf = (command: string, cwd?: string) =>
  gitExecFileAsyncMock.mock.calls.filter(
    ([args, options]) => args[0] === command && (cwd === undefined || options.cwd === cwd)
  )

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve()
  }
}

describe('refreshLocalBaseRefForWorktreeCreate deferred mutation', () => {
  beforeEach(() => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin')
    gitExecFileAsyncMock.mockReset()
  })

  afterEach(async () => {
    await _awaitPendingLocalBaseRefRefreshesForTests()
    vi.restoreAllMocks()
  })

  it('returns updated before reset --hard finishes, without the create abort signal', async () => {
    const reset = deferred()
    mockGit(() => reset.promise)
    const controller = new AbortController()

    const result = await refresh('/repo', { signal: controller.signal })

    expect(result).toEqual({
      status: 'updated',
      baseRef: 'origin/main',
      localBranch: 'main',
      ownerWorktreePath: '/repo'
    })
    expect(callsOf('reset')).toEqual([[['reset', '--hard', 'remote-main'], { cwd: '/repo' }]])
    reset.resolve()
  })

  it('makes a later refresh of the same repo wait for the pending reset before evaluating', async () => {
    const reset = deferred()
    mockGit((_args, cwd) => (cwd === '/repo' ? reset.promise : Promise.resolve({ stdout: '' })))

    await refresh('/repo')
    const second = refresh('/repo')
    const otherRepo = refresh('/other')
    await flushMicrotasks()

    expect(callsOf('rev-list', '/repo')).toHaveLength(1)
    await otherRepo
    expect(callsOf('rev-list', '/other')).toHaveLength(1)

    reset.resolve()
    await second
    expect(callsOf('rev-list', '/repo')).toHaveLength(2)
    expect(callsOf('reset', '/repo')).toHaveLength(2)
  })

  it('keys WSL refreshes separately from a native repo with the same path', async () => {
    const reset = deferred()
    mockGit((_args, cwd) => (cwd === '/repo' ? reset.promise : Promise.resolve({ stdout: '' })))

    await refresh('/repo')
    await refresh('/repo', { wslDistro: 'Ubuntu' })

    expect(callsOf('rev-list', '/repo')).toHaveLength(2)
    reset.resolve()
  })

  it('only warns when the deferred reset fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockGit(() => Promise.reject(new Error('index.lock exists')))

    const result = await refresh('/repo')
    await _awaitPendingLocalBaseRefRefreshesForTests()

    expect(result?.status).toBe('updated')
    expect(warn).toHaveBeenCalledWith(
      '[worktree-base-refresh] deferred local base ref update failed',
      expect.objectContaining({
        repoPath: '/repo',
        localBranch: 'main',
        ownerWorktreePath: '/repo',
        error: 'index.lock exists'
      })
    )
  })
})
