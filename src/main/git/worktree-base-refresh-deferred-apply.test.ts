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
  LocalBaseRefMutationGate,
  refreshLocalBaseRefForWorktreeCreate
} from './worktree-base-refresh'
import { LOCAL_BASE_REF_MUTATION_GATE_TIMEOUT_MS } from './worktree-base-refresh-deferred-apply'

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

const cleanOwnerStatusV2 = '# branch.oid old-main\n# branch.head main\n'
const primaryOnMain = (cwd: string): string => `worktree ${cwd}\nHEAD abc\nbranch refs/heads/main\n`
let ownerStatusV2 = cleanOwnerStatusV2
let worktreeListFor = primaryOnMain

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
        return Promise.resolve({ stdout: worktreeListFor(options.cwd) })
      case 'status':
        return Promise.resolve({ stdout: args.includes('--porcelain=v2') ? ownerStatusV2 : '' })
      case 'merge-base':
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
    ownerStatusV2 = cleanOwnerStatusV2
    worktreeListFor = primaryOnMain
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

  describe('gated by a create', () => {
    const primaryOnDevelop = (cwd: string): string =>
      `worktree ${cwd}\nHEAD abc\nbranch refs/heads/develop\n`

    it('starts nothing until the gate releases, then revalidates and resets', async () => {
      mockGit(() => Promise.resolve({ stdout: '' }))
      const gate = new LocalBaseRefMutationGate()

      const result = await refresh('/repo', { localBaseRefMutationGate: gate })
      await flushMicrotasks()

      expect(result?.status).toBe('updated')
      expect(callsOf('reset')).toHaveLength(0)
      expect(callsOf('status').some(([args]) => args.includes('--porcelain=v2'))).toBe(false)

      gate.release()
      await _awaitPendingLocalBaseRefRefreshesForTests()
      expect(callsOf('reset')).toEqual([[['reset', '--hard', 'remote-main'], { cwd: '/repo' }]])
    })

    it.each([
      ['dirty_worktree', `${cleanOwnerStatusV2}1 .M N... 100644 100644 100644 a b src/x.ts\n`],
      ['ref_moved', '# branch.oid newer\n# branch.head main\n'],
      ['branch_switched', '# branch.oid old-main\n# branch.head feature\n']
    ])('skips with a warning when the owner checkout changed (%s)', async (reason, status) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mockGit(() => Promise.resolve({ stdout: '' }))
      const gate = new LocalBaseRefMutationGate()

      await refresh('/repo', { localBaseRefMutationGate: gate })
      ownerStatusV2 = status
      gate.release()
      await _awaitPendingLocalBaseRefRefreshesForTests()

      expect(callsOf('reset')).toHaveLength(0)
      expect(warn).toHaveBeenCalledWith(
        '[worktree-base-refresh] deferred local base ref update skipped',
        expect.objectContaining({ repoPath: '/repo', ownerWorktreePath: '/repo', reason })
      )
    })

    it('skips update-ref when the branch became checked out somewhere', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      worktreeListFor = primaryOnDevelop
      mockGit(() => Promise.resolve({ stdout: '' }))
      const gate = new LocalBaseRefMutationGate()

      await refresh('/repo', { localBaseRefMutationGate: gate })
      worktreeListFor = (cwd) =>
        `${primaryOnDevelop(cwd)}\nworktree /wt\nHEAD abc\nbranch refs/heads/main\n`
      gate.release()
      await _awaitPendingLocalBaseRefRefreshesForTests()

      expect(callsOf('update-ref')).toHaveLength(0)
      expect(warn).toHaveBeenCalledWith(
        '[worktree-base-refresh] deferred local base ref update skipped',
        expect.objectContaining({ reason: 'branch_checked_out' })
      )
    })

    it('applies update-ref with the expected old oid when nothing changed', async () => {
      worktreeListFor = primaryOnDevelop
      mockGit(() => Promise.resolve({ stdout: '' }))
      const gate = new LocalBaseRefMutationGate()

      await refresh('/repo', { localBaseRefMutationGate: gate })
      expect(callsOf('update-ref')).toHaveLength(0)
      gate.release()
      await _awaitPendingLocalBaseRefRefreshesForTests()

      expect(callsOf('update-ref')).toEqual([
        [['update-ref', 'refs/heads/main', 'remote-main', 'old-main'], { cwd: '/repo' }]
      ])
    })

    it('lets a later create preempt a held mutation instead of waiting out that create', async () => {
      const reset = deferred()
      mockGit((_args, cwd) => (cwd === '/repo' ? reset.promise : Promise.resolve({ stdout: '' })))
      const gateA = new LocalBaseRefMutationGate()

      await refresh('/repo', { localBaseRefMutationGate: gateA })
      await flushMicrotasks()
      expect(callsOf('reset')).toHaveLength(0)

      const gateB = new LocalBaseRefMutationGate()
      const second = refresh('/repo', { localBaseRefMutationGate: gateB })
      await flushMicrotasks()
      // A's mutation started (after revalidating) without A releasing; B still waits for it to settle.
      expect(callsOf('status').some(([args]) => args.includes('--porcelain=v2'))).toBe(true)
      expect(callsOf('reset')).toHaveLength(1)
      expect(callsOf('rev-list', '/repo')).toHaveLength(1)

      reset.resolve()
      await second
      expect(callsOf('rev-list', '/repo')).toHaveLength(2)
      gateB.release()
    })

    it('lets an ungated refresh preempt a held mutation too', async () => {
      mockGit(() => Promise.resolve({ stdout: '' }))

      await refresh('/repo', { localBaseRefMutationGate: new LocalBaseRefMutationGate() })
      await refresh('/repo')

      expect(callsOf('rev-list', '/repo')).toHaveLength(2)
      expect(callsOf('reset')).toHaveLength(2)
    })

    it('does not deadlock when the same create refreshes twice', async () => {
      mockGit(() => Promise.resolve({ stdout: '' }))
      const gate = new LocalBaseRefMutationGate()

      await refresh('/repo', { localBaseRefMutationGate: gate })
      await refresh('/repo', { localBaseRefMutationGate: gate })
      await _awaitPendingLocalBaseRefRefreshesForTests()

      expect(callsOf('reset')).toHaveLength(2)
    })

    it('releases on its own after the safety timeout', async () => {
      vi.useFakeTimers()
      try {
        mockGit(() => Promise.resolve({ stdout: '' }))
        await refresh('/repo', { localBaseRefMutationGate: new LocalBaseRefMutationGate() })
        await vi.advanceTimersByTimeAsync(LOCAL_BASE_REF_MUTATION_GATE_TIMEOUT_MS - 1)
        expect(callsOf('reset')).toHaveLength(0)

        await vi.advanceTimersByTimeAsync(1)
        await _awaitPendingLocalBaseRefRefreshesForTests()
        expect(callsOf('reset')).toHaveLength(1)
      } finally {
        vi.useRealTimers()
      }
    })
  })
})
