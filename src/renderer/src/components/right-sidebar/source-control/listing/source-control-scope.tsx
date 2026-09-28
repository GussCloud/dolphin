import { createContext, useCallback, useContext } from 'react'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { useAppStore } from '@/store'

/** A member worktree the panel is pinned to; null means "follow the active worktree". */
const SourceControlScopeContext = createContext<string | null>(null)

export function SourceControlScopeProvider({
  worktreeId,
  children
}: {
  worktreeId: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <SourceControlScopeContext.Provider value={worktreeId}>
      {children}
    </SourceControlScopeContext.Provider>
  )
}

export function useSourceControlScopeWorktreeId(): string | null {
  return useContext(SourceControlScopeContext)
}

/**
 * Editor tabs belong to the worktree that owns the file, so opening a member repo's file from a
 * folder workspace must switch to that member first or the new tab lands off-screen.
 */
export function useRevealScopedWorktree(): () => void {
  const scopedWorktreeId = useContext(SourceControlScopeContext)
  return useCallback(() => {
    if (scopedWorktreeId && useAppStore.getState().activeWorktreeId !== scopedWorktreeId) {
      activateAndRevealWorktree(scopedWorktreeId)
    }
  }, [scopedWorktreeId])
}
