import type { StateCreator } from 'zustand'
import type {
  MultiProjectWorkspaceCreateArgs,
  MultiProjectWorkspaceCreateResult
} from '../../../../shared/multi-project-workspace-types'
import { getActiveRuntimeTarget } from '../../runtime/runtime-rpc-client'
import type { RepoSlice } from '../repos/repo-state'
import { applyCreatedWorktree } from '../slices/worktrees/create/created-worktree-state-merge'
import type { AppState } from '../types'
import { folderWorkspaceWithFetchedOwner } from './folder-workspace-catalog'

export function createMultiProjectWorkspaceAction(
  set: Parameters<StateCreator<AppState>>[0],
  get: Parameters<StateCreator<AppState>>[1]
): RepoSlice['createMultiProjectWorkspace'] {
  return async (
    args: MultiProjectWorkspaceCreateArgs
  ): Promise<MultiProjectWorkspaceCreateResult> => {
    const createMultiProject = window.api.worktrees.createMultiProject
    if (!createMultiProject) {
      throw new Error('Workspaces with several projects need the desktop app.')
    }
    const result = await createMultiProject(args)
    const ownedWorkspace = folderWorkspaceWithFetchedOwner(
      result.folderWorkspace,
      getActiveRuntimeTarget({ activeRuntimeEnvironmentId: null }),
      get().projectGroups
    )
    set((s) => ({
      folderWorkspaces: [
        ownedWorkspace,
        ...s.folderWorkspaces.filter((workspace) => workspace.id !== ownedWorkspace.id)
      ],
      folderWorkspacePathStatuses: {}
    }))
    // Why: members carry their lineage rows, which is what attaches them to the new workspace.
    for (const member of result.members) {
      applyCreatedWorktree(set, member.worktree.repoId, member)
    }
    return { ...result, folderWorkspace: ownedWorkspace }
  }
}
