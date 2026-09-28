import { create } from 'zustand'

/** Per project group: whether the composer creates a worktree in each project, and which ones. */
export type MultiProjectWorktreeSelection = {
  enabled: boolean
  /** null means every eligible project, so projects added later join by default. */
  repoIds: string[] | null
}

type MultiProjectWorktreeSelectionState = {
  byProjectGroupId: Record<string, MultiProjectWorktreeSelection>
  setEnabled: (projectGroupId: string, enabled: boolean) => void
  setRepoIds: (projectGroupId: string, repoIds: string[] | null) => void
}

const DISABLED_SELECTION: MultiProjectWorktreeSelection = { enabled: false, repoIds: null }

export const useMultiProjectWorktreeSelectionStore = create<MultiProjectWorktreeSelectionState>()(
  (set) => ({
    byProjectGroupId: {},
    setEnabled: (projectGroupId, enabled) =>
      set((s) => ({
        byProjectGroupId: {
          ...s.byProjectGroupId,
          [projectGroupId]: {
            ...(s.byProjectGroupId[projectGroupId] ?? DISABLED_SELECTION),
            enabled
          }
        }
      })),
    setRepoIds: (projectGroupId, repoIds) =>
      set((s) => ({
        byProjectGroupId: {
          ...s.byProjectGroupId,
          [projectGroupId]: {
            ...(s.byProjectGroupId[projectGroupId] ?? DISABLED_SELECTION),
            repoIds
          }
        }
      }))
  })
)

export function getMultiProjectWorktreeSelection(
  byProjectGroupId: Record<string, MultiProjectWorktreeSelection>,
  projectGroupId: string
): MultiProjectWorktreeSelection {
  return byProjectGroupId[projectGroupId] ?? DISABLED_SELECTION
}

/** The repo ids to create, or null when the composer should make a plain folder workspace. */
export function resolveMultiProjectWorktreeRepoIds(
  selection: MultiProjectWorktreeSelection,
  eligibleRepoIds: readonly string[]
): string[] | null {
  if (!selection.enabled || eligibleRepoIds.length === 0) {
    return null
  }
  if (selection.repoIds === null) {
    return [...eligibleRepoIds]
  }
  const eligible = new Set(eligibleRepoIds)
  const picked = selection.repoIds.filter((repoId) => eligible.has(repoId))
  // Why: a stale pick (projects removed since) falls back to all rather than a surprise plain workspace.
  return picked.length > 0 ? picked : [...eligibleRepoIds]
}
