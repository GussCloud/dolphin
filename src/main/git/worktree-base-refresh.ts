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
  type LocalBaseRefMutationGate,
  type LocalBaseRefRefreshPlan
} from './worktree-base-refresh-deferred-apply'
import { windowsParallelCheckoutGitArgs } from '../../shared/windows-parallel-checkout-git-args'
import { parseWorktreeList } from '../../shared/git-worktree-porcelain-parser'
import type { AddWorktreeOptions, GitWorktreeExecOptions } from './worktree-operation-options'
import { gitExecOptions } from './worktree-operation-options'

export { getLocalBaseRefUpdateSuggestionForWorktreeCreate }
export {
  _awaitPendingLocalBaseRefRefreshesForTests,
  LocalBaseRefMutationGate
} from './worktree-base-refresh-deferred-apply'

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
  options: GitWorktreeExecOptions & { localBaseRefMutationGate?: LocalBaseRefMutationGate } = {}
): Promise<LocalBaseRefRefreshResult | undefined> {
  return runSerializedLocalBaseRefRefresh(
    localBaseRefRefreshQueueKey(repoPath, options),
    () =>
      planLocalBaseRefRefresh(repoPath, baseBranch, remoteTrackingRef, remoteTrackingBase, options),
    options.localBaseRefMutationGate
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
          revalidate: () =>
            ownerCheckoutChangedSincePlan(
              currentOwner.path,
              evaluation.fullRef,
              evaluation.localOid,
              mutationOptions
            ),
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
      revalidate: async () => {
        const { stdout } = await gitExecFileAsync(
          ['worktree', 'list', '--porcelain'],
          gitExecOptions(repoPath, mutationOptions)
        )
        const owner = parseWorktreeList(translateWslOutputPaths(stdout, repoPath, options)).find(
          (wt) => wt.branch === evaluation.fullRef
        )
        // Moving a checked-out branch's ref under it would leave that checkout's index stale.
        return owner ? 'branch_checked_out' : undefined
      },
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

/** Skip reason when the owner checkout no longer has the planned branch at the planned oid, clean. */
async function ownerCheckoutChangedSincePlan(
  ownerPath: string,
  fullRef: string,
  localOid: string,
  options: GitWorktreeExecOptions
): Promise<string | undefined> {
  // Why porcelain=v2 (Git >=2.11): one call reports HEAD's branch, its oid, and tracked changes.
  const { stdout } = await gitExecFileAsync(
    ['status', '--porcelain=v2', '--branch', '--untracked-files=no'],
    gitExecOptions(ownerPath, options)
  )
  const lines = stdout.split(/\r?\n/).filter((line) => line.trim())
  const header = (name: string): string | undefined =>
    lines.find((line) => line.startsWith(`# ${name} `))?.slice(name.length + 3)
  if (`refs/heads/${header('branch.head') ?? ''}` !== fullRef) {
    return 'branch_switched'
  }
  if (header('branch.oid') !== localOid) {
    return 'ref_moved'
  }
  return lines.some((line) => !line.startsWith('#')) ? 'dirty_worktree' : undefined
}
