import { parseWorkspaceKey } from '../shared/workspace-scope'
import { getWorktreePathBasenameFromId } from '../shared/worktree/id'
import type { Store } from './persistence'

/** The name a user knows a workspace by: folder name, worktree display name, else its path basename. */
export function resolveWorkspaceDisplayName(
  store: Pick<Store, 'getFolderWorkspace' | 'getWorktreeMeta'>,
  worktreeId: string
): string | null {
  const scope = parseWorkspaceKey(worktreeId)
  const name =
    scope?.type === 'folder'
      ? store.getFolderWorkspace(scope.folderWorkspaceId)?.name
      : store.getWorktreeMeta(worktreeId)?.displayName
  return name?.trim() || getWorktreePathBasenameFromId(worktreeId)
}
