import type { AppState } from '@/store/types'
import type { ExecutionHostId } from '../../../../../shared/execution-host'
import { collectLeafIdsInOrder } from '../terminal-layout-leaf-ids'
import { isWorktreeDeletePending } from './worktree-delete-pending'

// Main can give a remounted pane the same PTY, so disposal alone does not make it ownerless.
export function shouldRetainDisposedPaneSpawn(
  state: Pick<AppState, 'tabsByWorktree' | 'terminalLayoutsByTabId' | 'deleteStateByWorktreeId'>,
  worktreeId: string,
  tabId: string,
  leafId: string,
  executionHostId?: ExecutionHostId
): boolean {
  if (isWorktreeDeletePending(state, worktreeId, executionHostId)) {
    return false
  }
  const tabPresent = Object.values(state.tabsByWorktree).some((tabs) =>
    tabs.some((tab) => tab.id === tabId)
  )
  if (!tabPresent) {
    return false
  }
  // A new single-pane tab has no layout root until its first pane binds.
  const root = state.terminalLayoutsByTabId[tabId]?.root
  return !root || collectLeafIdsInOrder(root).includes(leafId)
}
