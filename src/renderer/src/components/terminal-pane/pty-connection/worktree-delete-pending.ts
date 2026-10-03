import type { AppState } from '@/store/types'
import type { WorktreeDeleteState } from '@/store/slices/worktree-helpers'
import type { ExecutionHostId } from '../../../../../shared/execution-host'
import { composeWorktreeHostIdentity } from '../../../../../shared/worktree/host-qualified-identity'

type DeleteStateInput = Pick<AppState, 'deleteStateByWorktreeId'>

function findDeleteState(
  state: DeleteStateInput,
  worktreeId: string,
  executionHostId?: ExecutionHostId | null
): WorktreeDeleteState | undefined {
  const deleteState =
    (executionHostId
      ? state.deleteStateByWorktreeId?.[composeWorktreeHostIdentity(executionHostId, worktreeId)]
      : undefined) ?? state.deleteStateByWorktreeId?.[worktreeId]
  return !deleteState?.executionHostId || deleteState.executionHostId === executionHostId
    ? deleteState
    : undefined
}

export function isWorktreeDeletePending(
  state: DeleteStateInput,
  worktreeId: string,
  executionHostId?: ExecutionHostId | null
): boolean {
  return findDeleteState(state, worktreeId, executionHostId)?.isDeleting === true
}

/** A delete that settled with an error left the worktree (and this pane) in place. */
export function didWorktreeDeleteFail(
  state: DeleteStateInput,
  worktreeId: string,
  executionHostId?: ExecutionHostId | null
): boolean {
  const deleteState = findDeleteState(state, worktreeId, executionHostId)
  return deleteState?.isDeleting === false && Boolean(deleteState.error)
}
