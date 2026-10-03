import { useAppStore } from '@/store'
import type { ConnectPanePtySession } from './connect-pane-pty-session'
import { didWorktreeDeleteFail, isWorktreeDeletePending } from './worktree-delete-pending'

/**
 * Holds an exit caused by a workspace delete until the delete settles. Success unmounts the pane,
 * so nothing is shown; a failed delete leaves the worktree in place with a dead pane, which gets
 * its own overlay instead of the generic "terminal exited" one. Returns false when no delete runs.
 */
export function deferExitUntilWorktreeDeleteSettles(
  session: ConnectPanePtySession,
  exitCode: number
): boolean {
  const { worktreeId } = session.deps
  if (!isWorktreeDeletePending(useAppStore.getState(), worktreeId, session.executionHostId)) {
    return false
  }
  const unsubscribe = useAppStore.subscribe((state) => {
    if (isWorktreeDeletePending(state, worktreeId, session.executionHostId)) {
      return
    }
    teardown()
    if (session.disposed || !didWorktreeDeleteFail(state, worktreeId, session.executionHostId)) {
      return
    }
    session.deps.onPaneProcessDied?.({
      paneId: session.pane.id,
      exitCode,
      startup: null,
      reason: 'workspace-delete-failed'
    })
  })
  const teardown = (): void => {
    unsubscribe()
    const index = session.waitTeardowns.indexOf(teardown)
    if (index !== -1) {
      session.waitTeardowns.splice(index, 1)
    }
  }
  session.waitTeardowns.push(teardown)
  return true
}
