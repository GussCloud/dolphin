import { app } from 'electron'
import { parsePaneKey } from '../../shared/stable-pane-id'
import { getRepoIdFromWorktreeId } from '../../shared/worktree/id'
import { getTrustedUIRendererWindow } from '../ipc/ui'
import { safelyRevealWindow } from './focus-existing-window'
import { isBackgroundLaunch } from './foreground-activation-policy'

export type AgentPaneRevealTarget = {
  worktreeId?: string
  paneKey?: string
  /** Absent means a terminal pane, which every sender predating structured chat is. */
  surface?: 'terminal' | 'agent-session'
}

/**
 * Brings the main window forward and opens the agent's pane, or returns null when the target
 * cannot be addressed (a click on it would do nothing, so callers should not bind one).
 */
export function resolveAgentPaneReveal(target: AgentPaneRevealTarget): (() => void) | null {
  const { worktreeId, paneKey } = target
  const paneTarget = paneKey ? parsePaneKey(paneKey) : null
  // Why: a structured chat has no PTY pane. Its pane key's leaf is a synthetic id minted from
  // the session, so focusTerminal would hunt a split-layout leaf that does not exist; the
  // unified tab id in the same key is what reveals the chat.
  const chatTarget = target.surface === 'agent-session' ? paneTarget : null
  // Why: worktreeId is formatted "repoId::worktreePath"; without the separator we can't extract a
  // repoId to activate. A folder workspace ("folder:<id>") has none, but a chat reveal selects its
  // workspace itself, so only the terminal route needs the repoId to bind a click at all.
  const repoId = worktreeId?.includes('::') ? getRepoIdFromWorktreeId(worktreeId) : null
  if (!worktreeId || (repoId === null && !chatTarget)) {
    return null
  }
  return () => {
    const win = getTrustedUIRendererWindow()
    if (!win || win.isDestroyed()) {
      return
    }
    if (process.platform === 'darwin' && !isBackgroundLaunch()) {
      app.focus({ steal: true })
    }
    safelyRevealWindow(win)
    if (repoId !== null) {
      win.webContents.send('ui:activateWorktree', { repoId, worktreeId })
    }
    if (chatTarget) {
      win.webContents.send('ui:focusEditorTab', {
        tabId: chatTarget.tabId,
        worktreeId,
        userInitiated: true
      })
      return
    }
    if (!paneTarget) {
      return
    }
    // Why: focusTerminal targets the pane by stable leafId so split-pane notifications land on the exact pane.
    win.webContents.send('ui:focusTerminal', {
      tabId: paneTarget.tabId,
      worktreeId,
      leafId: paneTarget.leafId,
      ackPaneKeyOnSuccess: paneKey,
      flashFocusedPane: true,
      scrollToBottomIfOutputSinceLastView: true
    })
  }
}
