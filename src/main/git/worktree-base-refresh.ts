import type { LocalBaseRefRefreshResult } from '../../shared/worktree/base-ref-drift-types'
import { gitExecFileAsync, translateWslOutputPaths } from './runner'
import { runWithGitReadCacheInvalidation } from './status'
import {
  evaluateLocalBaseRefRefreshability,
  getLocalBaseRefUpdateSuggestionForWorktreeCreate
} from './worktree-base-refresh-analysis'
import {
  localBaseRefRefreshQueueKey,
  runSerializedLocalBaseRefRefresh,
  type LocalBaseRefRefreshPlan
} from './worktree-base-refresh-deferred-apply'
import { windowsParallelCheckoutGitArgs } from '../../shared/windows-parallel-checkout-git-args'
import { parseWorktreeList } from '../../shared/git-worktree-porcelain-parser'
import type { AddWorktreeOptions, GitWorktreeExecOptions } from './worktree-operation-options'
import { gitExecOptions } from './worktree-operation-options'

export { getLocalBaseRefUpdateSuggestionForWorktreeCreate }
export { _awaitPendingLocalBaseRefRefreshesForTests } from './worktree-base-refresh-deferred-apply'

type RefreshPlan = LocalBaseRefRefreshPlan<LocalBaseRefRefreshResult | undefined>

/**
 * The new worktree is based on the remote-tracking ref either way, so the local-branch
 * fast-forward runs after the create returns; only the checks that decide the result block it.
 */
export function refreshLocalBaseRefForWorktreeCreate(
  repoPath: string,
  baseBranch: string,
  remoteTrackingRef: string,
  remoteTrackingBase?: AddWorktreeOptions['remoteTrackingBase'],
  options: GitWorktreeExecOptions = {}
): Promise<LocalBaseRefRefreshResult | undefined> {
  return runSerializedLocalBaseRefRefresh(localBaseRefRefreshQueueKey(repoPath, options), () =>
    planLocalBaseRefRefresh(repoPath, baseBranch, remoteTrackingRef, remoteTrackingBase, options)
  )
}

async function planLocalBaseRefRefresh(
  repoPath: string,
  baseBranch: string,
  remoteTrackingRef: string,
  remoteTrackingBase: AddWorktreeOptions['remoteTrackingBase'],
  options: GitWorktreeExecOptions
): Promise<RefreshPlan> {
  const evaluation = await evaluateLocalBaseRefRefreshability(
    repoPath,
    baseBranch,
    remoteTrackingRef,
    remoteTrackingBase,
    options
  )
  if (!evaluation) {
    return { result: undefined }
  }
  if (!evaluation.refreshable) {
    return { result: evaluation.result }
  }

  const resultBase = { baseRef: evaluation.baseRef, localBranch: evaluation.localBranch }
  // Why: the mutation outlives the create, so the create's abort signal must not kill a half-applied reset --hard.
  const mutationOptions: GitWorktreeExecOptions = { ...options, signal: undefined }
  const context = { repoPath, localBranch: evaluation.localBranch, wslDistro: options.wslDistro }
  try {
    if (evaluation.ownerWorktreePath) {
      const { stdout: worktreeListOutput } = await gitExecFileAsync(
        ['worktree', 'list', '--porcelain'],
        gitExecOptions(repoPath, options)
      )
      const worktrees = parseWorktreeList(
        translateWslOutputPaths(worktreeListOutput, repoPath, options)
      )
      const currentOwner = worktrees.find((wt) => wt.branch === evaluation.fullRef)
      if (!currentOwner || currentOwner.path !== evaluation.ownerWorktreePath) {
        return { result: { ...resultBase, status: 'skipped_error' } }
      }
      const { stdout: status } = await gitExecFileAsync(
        ['status', '--porcelain', '--untracked-files=no'],
        gitExecOptions(currentOwner.path, options)
      )
      if (status.trim()) {
        return {
          result: {
            ...resultBase,
            status: 'skipped_dirty_worktree',
            ownerWorktreePath: currentOwner.path
          }
        }
      }
      return {
        result: { ...resultBase, status: 'updated', ownerWorktreePath: currentOwner.path },
        deferredMutation: {
          context: { ...context, ownerWorktreePath: currentOwner.path },
          start: () =>
            runWithGitReadCacheInvalidation(() =>
              gitExecFileAsync(
                [
                  ...windowsParallelCheckoutGitArgs(currentOwner.path),
                  'reset',
                  '--hard',
                  evaluation.remoteOid
                ],
                gitExecOptions(currentOwner.path, mutationOptions)
              )
            )
        }
      }
    }
  } catch {
    // Owner revalidation can fail on odd worktree states; worktree creation should still proceed.
    return { result: { ...resultBase, status: 'skipped_error' } }
  }

  // Why: no owner worktree — fast-forward the bare ref; the expected-old-OID form is a no-op-safe CAS if the ref moved since evaluation.
  return {
    result: { ...resultBase, status: 'updated' },
    deferredMutation: {
      context,
      start: () =>
        runWithGitReadCacheInvalidation(() =>
          gitExecFileAsync(
            ['update-ref', evaluation.fullRef, evaluation.remoteOid, evaluation.localOid],
            gitExecOptions(repoPath, mutationOptions)
          )
        )
    }
  }
}
