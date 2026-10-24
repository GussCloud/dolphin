import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DolphinRuntimeService } from '../runtime/dolphin-runtime'
import { OrchestrationDb } from '../runtime/orchestration/db'
import { RpcDispatcher } from '../runtime/rpc/dispatcher'
import { WORKTREE_METHODS } from '../runtime/rpc/methods/worktree'
import { HOSTED_REVIEW_METHODS } from '../runtime/rpc/methods/hosted-review'
import { ORCHESTRATION_METHODS } from '../runtime/rpc/methods/orchestration'
import { createAutonomousGoalCleanupRpcPorts } from './autonomous-goal-cleanup-ports'

// Why the real dispatcher and method table: the ports must speak the verbs' actual Zod contracts,
// so a renamed or missing param fails here instead of silently leaving worktrees behind.
describe('autonomous goal cleanup RPC ports', () => {
  let db: OrchestrationDb
  let runtime: DolphinRuntimeService
  let ports: ReturnType<typeof createAutonomousGoalCleanupRpcPorts>

  beforeEach(() => {
    db = new OrchestrationDb(':memory:')
    runtime = new DolphinRuntimeService()
    runtime.setOrchestrationDb(db)
    const dispatcher = new RpcDispatcher({
      runtime,
      methods: [...WORKTREE_METHODS, ...HOSTED_REVIEW_METHODS, ...ORCHESTRATION_METHODS]
    })
    ports = createAutonomousGoalCleanupRpcPorts({
      dispatch: (request) => dispatcher.dispatch(request),
      runtime
    })
    vi.spyOn(runtime, 'showManagedWorktree').mockResolvedValue({
      id: 'repo::wt-1',
      repoId: 'repo',
      branch: 'refs/heads/feature/x',
      hostId: 'local'
    } as never)
  })

  afterEach(() => {
    db.close()
    vi.restoreAllMocks()
  })

  it('removes a worktree through worktree.rm without forcing it', async () => {
    const remove = vi.spyOn(runtime, 'removeManagedWorktree').mockResolvedValue({} as never)
    expect(await ports.removeWorktree('repo::wt-1')).toEqual({ removed: true })
    expect(remove).toHaveBeenCalledWith(
      'id:repo::wt-1',
      expect.objectContaining({ force: false, allowUnverifiedPtyStop: false })
    )
  })

  it('reports why a worktree was kept', async () => {
    vi.spyOn(runtime, 'removeManagedWorktree').mockRejectedValue(
      new Error('worktree has uncommitted changes')
    )
    expect(await ports.removeWorktree('repo::wt-1')).toEqual({
      removed: false,
      reason: 'worktree has uncommitted changes'
    })
  })

  it('reads the merge state of the worktree branch through hostedReview.forBranch', async () => {
    const review = vi
      .spyOn(runtime, 'getHostedReviewForBranch')
      .mockResolvedValueOnce({ state: 'merged' } as never)
      .mockResolvedValueOnce({ state: 'open' } as never)
    expect(await ports.isWorktreeReviewMerged('repo::wt-1')).toBe(true)
    expect(await ports.isWorktreeReviewMerged('repo::wt-1')).toBe(false)
    expect(review).toHaveBeenCalledWith(
      expect.objectContaining({ repoSelector: 'repo', branch: 'feature/x' })
    )
  })

  it('reaches orchestration.workerRelease past its contract and param gates', async () => {
    // Why: without the contract version the verb refuses every call as obsolete, and the sweep
    // would leave every worker terminal running; reaching the dispatch lookup proves it got through.
    await expect(ports.releaseWorker('dispatch-missing')).rejects.toMatchObject({
      code: 'dispatch_not_found'
    })
  })

  it('lists no workers for a Run that never started any', () => {
    const runId = db.createRun({
      objective: 'x',
      coordinatorHandle: 'term_c',
      coordinatorPaneKey: 'tab_c:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    }).id
    expect(ports.listWorkers(runId)).toEqual([])
  })
})
