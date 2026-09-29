import { rmdir } from 'node:fs/promises'
import { join } from 'node:path'
import { WORKTREE_TRASH_DIR_NAME, whenWorktreeTrashDeletionsSettled } from './worktree-trash'

/**
 * Removes a deleted multi-project workspace's container once it is empty. Member worktrees are
 * trashed beside themselves, so the container's trash root must drain first. Non-recursive: any file
 * someone else left in the container keeps it on disk.
 */
export async function removeEmptyMultiProjectContainer(containerPath: string): Promise<void> {
  await whenWorktreeTrashDeletionsSettled()
  await rmdir(join(containerPath, WORKTREE_TRASH_DIR_NAME)).catch(() => {})
  await rmdir(containerPath).catch(() => {})
}
