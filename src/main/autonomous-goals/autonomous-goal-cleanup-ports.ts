// The host side of goal cleanup: every action goes through the same RPC verbs a user or the CLI
// would call, so their safety checks (settled workers only, no forced removal) apply unchanged.
import { randomUUID } from 'node:crypto'
import type { RpcRequest, RpcResponse } from '../runtime/rpc/core'
import type { DolphinRuntimeService } from '../runtime/dolphin-runtime'
import type { AutonomousGoalCleanupPorts } from './autonomous-goal-cleanup'
import { ORCHESTRATION_CONTRACT_VERSION } from '../../shared/protocol-version'

type CleanupRuntime = Pick<DolphinRuntimeService, 'getOrchestrationDb' | 'showManagedWorktree'>

export function createAutonomousGoalCleanupRpcPorts(args: {
  dispatch: (request: RpcRequest) => Promise<RpcResponse>
  runtime: CleanupRuntime
}): Pick<
  AutonomousGoalCleanupPorts,
  'listWorkers' | 'releaseWorker' | 'isWorktreeReviewMerged' | 'removeWorktree'
> {
  const callRpc = async (method: string, params: unknown): Promise<unknown> => {
    const response = await args.dispatch({
      id: `autonomous-goal-cleanup-${randomUUID()}`,
      authToken: 'autonomous-goal-cleanup',
      method,
      params,
      // Why: orchestration mutations refuse callers that do not state the contract they speak.
      ...(method.startsWith('orchestration.')
        ? { orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION }
        : {})
    })
    if (!response.ok) {
      throw Object.assign(new Error(response.error.message), { code: response.error.code })
    }
    return response.result
  }
  return {
    listWorkers: (runId) =>
      args.runtime
        .getOrchestrationDb()
        .listWorkerTerminalResources({ runId })
        .map((row) => ({
          dispatchId: row.dispatchId,
          workerState: row.workerState,
          worktreeId: row.worktreeId,
          terminalState: row.terminalState
        })),
    releaseWorker: async (dispatchId) => {
      await callRpc('orchestration.workerRelease', { dispatch: dispatchId })
    },
    isWorktreeReviewMerged: async (worktreeId) => {
      const worktree = await args.runtime.showManagedWorktree(`id:${worktreeId}`)
      const branch = worktree.branch.replace(/^refs\/heads\//, '')
      const review = await callRpc('hostedReview.forBranch', { repo: worktree.repoId, branch })
      return (
        typeof review === 'object' &&
        review !== null &&
        'state' in review &&
        review.state === 'merged'
      )
    },
    removeWorktree: async (worktreeId) => {
      try {
        await callRpc('worktree.rm', { worktree: `id:${worktreeId}` })
        return { removed: true }
      } catch (error) {
        // Why: a worktree already gone (removed by hand or a previous sweep) is the goal state.
        if (
          error instanceof Error &&
          (error.message === 'selector_not_found' ||
            ('code' in error && error.code === 'selector_not_found'))
        ) {
          return { removed: true }
        }
        return { removed: false, reason: error instanceof Error ? error.message : String(error) }
      }
    }
  }
}
