import { create } from 'zustand'

/** Projects added beside the composer's primary project; each becomes a worktree in one workspace. */
type MultiProjectComposerSelectionState = {
  extraRepoIds: string[]
  addRepoIds: (repoIds: readonly string[]) => void
  removeRepoId: (repoId: string) => void
  reset: () => void
}

export const useMultiProjectComposerSelectionStore = create<MultiProjectComposerSelectionState>()(
  (set) => ({
    extraRepoIds: [],
    addRepoIds: (repoIds) =>
      set((s) => ({
        extraRepoIds: [
          ...s.extraRepoIds,
          ...repoIds.filter(
            (repoId, index) => !s.extraRepoIds.includes(repoId) && repoIds.indexOf(repoId) === index
          )
        ]
      })),
    removeRepoId: (repoId) =>
      set((s) => ({ extraRepoIds: s.extraRepoIds.filter((entry) => entry !== repoId) })),
    reset: () => set({ extraRepoIds: [] })
  })
)
