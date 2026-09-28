import { useCallback, useEffect, useRef } from 'react'
import { getConnectionId } from '@/lib/connection-context'
import { isWindowVisible } from '@/lib/window-visibility-interval'
import { useAppStore } from '@/store'
import { getRightSidebarWorktreeRuntimeSettings } from './file-explorer-runtime-owner'
import type { FolderWorkspaceGitMember } from './folder-workspace-git-members'
import { refreshGitStatusForWorktree } from './git-status-refresh'

const MEMBER_STATUS_INTERVAL_MS = 30_000

/**
 * Keeps each member row's change count fresh. Active-worktree polling only covers the folder
 * workspace itself, which has no git state, so members need their own low-rate lane.
 */
export function useFolderWorkspaceMemberGitStatus(
  members: readonly FolderWorkspaceGitMember[],
  enabled: boolean
): () => void {
  const refreshNowRef = useRef<() => void>(() => {})
  const membersRef = useRef(members)
  useEffect(() => {
    membersRef.current = members
  }, [members])
  // Why: keyed on identity + path so store churn that rebuilds the array doesn't restart the lane.
  const memberKey = members
    .map((member) => `${member.worktree.id}\0${member.worktree.path}`)
    .join('\n')

  useEffect(() => {
    if (!enabled || memberKey === '') {
      return
    }
    const controller = new AbortController()
    const refreshAll = async (): Promise<void> => {
      if (!isWindowVisible()) {
        return
      }
      const state = useAppStore.getState()
      // Why: sequential so a large folder workspace can't fan out N git subprocesses at once.
      for (const { worktree } of membersRef.current) {
        if (controller.signal.aborted) {
          return
        }
        try {
          await refreshGitStatusForWorktree({
            settings: getRightSidebarWorktreeRuntimeSettings(worktree.id),
            worktreeId: worktree.id,
            worktreePath: worktree.path,
            connectionId: getConnectionId(worktree.id) ?? undefined,
            pushTarget: worktree.pushTarget,
            deps: {
              setGitStatus: state.setGitStatus,
              updateWorktreeGitIdentity: state.updateWorktreeGitIdentity,
              setUpstreamStatus: state.setUpstreamStatus,
              fetchUpstreamStatus: state.fetchUpstreamStatus
            },
            request: {
              admissionTier: 'background',
              signal: controller.signal,
              shouldApply: () => !controller.signal.aborted
            }
          })
        } catch {
          // A member that fails to refresh keeps its last known status.
        }
      }
    }
    refreshNowRef.current = () => void refreshAll()
    void refreshAll()
    const interval = window.setInterval(() => void refreshAll(), MEMBER_STATUS_INTERVAL_MS)
    return () => {
      refreshNowRef.current = () => {}
      controller.abort()
      window.clearInterval(interval)
    }
  }, [enabled, memberKey])
  return useCallback(() => refreshNowRef.current(), [])
}
