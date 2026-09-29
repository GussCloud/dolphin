import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import { getWorktreeOnHostFromState } from '@/store/selectors'
import type { Worktree } from '../../../../shared/worktree/types'
import { folderWorkspaceKey, parseWorkspaceKey } from '../../../../shared/workspace-scope'

export const ADD_MULTI_PROJECT_MEMBER_MODAL = 'add-multi-project-member'

/** The worktrees attached to a multi-project workspace, one per member project. */
export function getMultiProjectWorkspaceMembers(
  state: Pick<AppState, 'folderWorkspaces' | 'workspaceLineageByChildKey' | 'worktreesByRepo'>,
  folderWorkspaceId: string
): Worktree[] {
  const workspace = state.folderWorkspaces.find((entry) => entry.id === folderWorkspaceId)
  if (workspace?.kind !== 'multi-project') {
    return []
  }
  const parentKey = folderWorkspaceKey(folderWorkspaceId)
  const members: Worktree[] = []
  for (const lineage of Object.values(state.workspaceLineageByChildKey)) {
    const child = parseWorkspaceKey(lineage.childWorkspaceKey)
    if (lineage.parentWorkspaceKey !== parentKey || child?.type !== 'worktree') {
      continue
    }
    const worktree = getWorktreeOnHostFromState(state, child.worktreeId, undefined)
    if (worktree) {
      members.push(worktree)
    }
  }
  return members
}

/** The branch every member checked out, so a newly added project joins the same one. */
export function getMultiProjectSharedBranchName(
  members: readonly Pick<Worktree, 'branch'>[]
): string | undefined {
  const branch = members.find((member) => member.branch)?.branch
  return branch ? branch.replace(/^refs\/heads\//, '') : undefined
}

export function openAddMultiProjectMemberDialog(folderWorkspaceId: string): void {
  useAppStore.getState().openModal(ADD_MULTI_PROJECT_MEMBER_MODAL, { folderWorkspaceId })
}
