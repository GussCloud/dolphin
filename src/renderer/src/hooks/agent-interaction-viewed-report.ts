import { AGENT_INTERACTION_VIEWED_WORKTREES_MAX } from '../../../shared/agent-interaction-avatar-ipc'

/**
 * Tells main which workspaces the user is looking at, so the floating avatar drops the cues they
 * answer by opening a workspace and skips cues for one already on screen.
 *
 * Why deduped: the auto-ack scan runs on every status write; only a change in what is on screen
 * (or a presence signal, which re-confirms it) is worth an IPC.
 */
export function createAgentInteractionViewedReporter(
  send: (worktreeIds: string[]) => void
): (worktreeIds: readonly (string | null)[], options?: { force?: boolean }) => void {
  let lastKey: string | null = null
  return (worktreeIds, options) => {
    const ids = [...new Set(worktreeIds.filter((id): id is string => Boolean(id)))]
      .sort()
      .slice(0, AGENT_INTERACTION_VIEWED_WORKTREES_MAX)
    const key = ids.join('\n')
    if (key === lastKey && !options?.force) {
      return
    }
    lastKey = key
    send(ids)
  }
}
