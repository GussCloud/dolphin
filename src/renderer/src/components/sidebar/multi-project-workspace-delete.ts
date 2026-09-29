import { useAppStore } from '@/store'
import type { ExecutionHostId } from '../../../../shared/execution-host'
import { toWorktreeRemovalTarget } from '../../../../shared/worktree/removal'
import { folderWorkspaceKey } from '../../../../shared/workspace-scope'
import { getMultiProjectWorkspaceMembers } from './multi-project-workspace-members'
import { runWorktreeDeleteWithToast } from './run-worktree-delete-with-toast'

export const DELETE_MULTI_PROJECT_WORKSPACE_MODAL = 'delete-multi-project-workspace'

export type DeleteMultiProjectWorkspaceModalData = {
  folderWorkspaceId: string
  executionHostId?: ExecutionHostId
}

/**
 * Deleting a multi-project workspace should also offer to delete its worktrees, which plain
 * folder workspaces don't have. Returns true when the confirmation dialog took over.
 */
export function openMultiProjectDeleteDialogIfNeeded(
  folderWorkspaceId: string,
  executionHostId?: ExecutionHostId
): boolean {
  const state = useAppStore.getState()
  if (getMultiProjectWorkspaceMembers(state, folderWorkspaceId).length === 0) {
    return false
  }
  const data: DeleteMultiProjectWorkspaceModalData = {
    folderWorkspaceId,
    ...(executionHostId ? { executionHostId } : {})
  }
  state.openModal(DELETE_MULTI_PROJECT_WORKSPACE_MODAL, data)
  return true
}

/**
 * Deletes the member worktrees first, then the workspace. A member that can't be deleted (e.g.
 * uncommitted changes) stops here and keeps the workspace, so nothing is left half attached.
 */
export async function deleteMultiProjectWorkspace(args: {
  folderWorkspaceId: string
  executionHostId?: ExecutionHostId
  removeMembers: boolean
}): Promise<boolean> {
  if (args.removeMembers) {
    for (const member of getMultiProjectWorkspaceMembers(
      useAppStore.getState(),
      args.folderWorkspaceId
    )) {
      const removed = await runWorktreeDeleteWithToast(
        toWorktreeRemovalTarget(member),
        member.displayName,
        { focusSuccessorOnDelete: false }
      )
      if (!removed) {
        return false
      }
    }
  }
  const state = useAppStore.getState()
  const deleted = await state.deleteFolderWorkspace(
    args.folderWorkspaceId,
    args.executionHostId ? { executionHostId: args.executionHostId } : undefined
  )
  const current = useAppStore.getState()
  if (deleted && current.activeWorktreeId === folderWorkspaceKey(args.folderWorkspaceId)) {
    current.setActiveWorktree(null)
  }
  return deleted
}
