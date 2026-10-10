import type { MutableRefObject } from 'react'
import { useAppStore } from '@/store'
import type { BrowserGuestVisibility } from './browser-guest-churn-throttle'

/**
 * Visible = its worktree is on screen, or something paints it anyway (automation, mobile, remote
 * viewer). Worktree-level, not page-level: an inactive tab of the active worktree still shows its
 * title in the tab strip.
 */
export function createBrowserGuestWorktreeVisibility(
  worktreeId: string,
  isPaintableRef: MutableRefObject<boolean>
): BrowserGuestVisibility {
  return {
    isVisible: () =>
      isPaintableRef.current || useAppStore.getState().activeWorktreeId === worktreeId,
    onBecameVisible: (listener) =>
      useAppStore.subscribe((state, previousState) => {
        if (
          state.activeWorktreeId !== previousState.activeWorktreeId &&
          state.activeWorktreeId === worktreeId
        ) {
          listener()
        }
      })
  }
}
