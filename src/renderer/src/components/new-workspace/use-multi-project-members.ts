import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { useMultiProjectComposerSelectionStore } from '@/store/multi-project-composer-selection'
import { resolveMultiProjectMemberRepoIds } from './multi-project-workspace-eligibility'

/** Why: web clients reach a remote host, which can't place worktrees on this machine's disk. */
export function canHostCreateMultiProjectWorkspace(): boolean {
  return typeof window.api?.worktrees?.createMultiProject === 'function'
}

/**
 * The repo ids a composer submit turns into one worktree each, or null for an ordinary create.
 * A project-group target keeps its own folder-workspace flow.
 */
export function useMultiProjectMemberRepoIds(
  primaryRepoId: string | null,
  isProjectGroupTarget: boolean
): string[] | null {
  const repos = useAppStore((s) => s.repos)
  const extraRepoIds = useMultiProjectComposerSelectionStore((s) => s.extraRepoIds)
  return useMemo(() => {
    if (
      isProjectGroupTarget ||
      extraRepoIds.length === 0 ||
      !canHostCreateMultiProjectWorkspace()
    ) {
      return null
    }
    return resolveMultiProjectMemberRepoIds({ primaryRepoId, extraRepoIds, repos })
  }, [extraRepoIds, isProjectGroupTarget, primaryRepoId, repos])
}
