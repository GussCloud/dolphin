import { useAppStore } from '@/store'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { activateTabAndFocusPane } from '@/lib/activate-tab-and-focus-pane'
import { activateStructuredAgentSessionTab } from '@/lib/structured-agent-session-tab-activation'
import { parsePaneKey } from '../../../../shared/stable-pane-id'
import { dismissStaleAgentRowByKey } from '../terminal-pane/stale-agent-row'

/** Reveal an agent row's workspace and focus its pane, dismissing the row when it no longer resolves. */
export function activateAgentPane(worktreeId: string, tabId: string, paneKey: string): void {
  const parsed = parsePaneKey(paneKey)
  if (!parsed) {
    // Why: malformed/legacy numeric keys can't be resolved after pane replay/remount, so drop the stale row instead of guessing.
    console.warn('[activateAgentPane] malformed paneKey, skipping pane focus', paneKey)
    dismissStaleAgentRowByKey(paneKey)
    return
  }
  if (parsed.tabId !== tabId) {
    console.warn('[activateAgentPane] paneKey tabId mismatch, dismissing row', {
      tabId,
      paneKey
    })
    dismissStaleAgentRowByKey(paneKey)
    return
  }
  // Why: design-doc rule — every user-initiated worktree switch must route through activateAndRevealWorktree (cross-repo activation + nav history).
  activateAndRevealWorktree(worktreeId)
  const tabs = useAppStore.getState().tabsByWorktree[worktreeId] ?? []
  if (tabs.some((t) => t.id === tabId)) {
    activateTabAndFocusPane(tabId, parsed.leafId, {
      ackPaneKeyOnSuccess: paneKey,
      flashFocusedPane: true,
      scrollToBottomIfOutputSinceLastView: true
    })
  } else if (!activateStructuredAgentSessionTab({ worktreeId, tabId })) {
    const liveEntry = useAppStore.getState().agentStatusByPaneKey[paneKey]
    if (liveEntry?.worktreeId === worktreeId) {
      // Why: orchestration worker status can be worktree-attributed before the renderer knows its tab; keep the live row instead of dismissing as stale.
      return
    }
    dismissStaleAgentRowByKey(paneKey)
  }
}
