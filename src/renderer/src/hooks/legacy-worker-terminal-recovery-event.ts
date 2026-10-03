import type { CloseTerminalPaneDetail } from '@/constants/terminal'
import { parsePaneKey } from '../../../shared/stable-pane-id'
import {
  closeTerminalLeafInStore,
  type TerminalLeafStoreCloseStore
} from './terminal-leaf-store-close'

type LegacyWorkerTerminalRecoveryEvent = {
  paneKey: string
  resolution: 'adopted' | 'exited' | 'rolled_back'
  ptyId?: string
}

export type LegacyWorkerTerminalRecoveryAction =
  | { kind: 'clear-sleeping'; paneKey: string }
  | { kind: 'rollback-surface'; detail: CloseTerminalPaneDetail }
  | { kind: 'ignore' }

export function resolveLegacyWorkerTerminalRecoveryAction(
  event: LegacyWorkerTerminalRecoveryEvent
): LegacyWorkerTerminalRecoveryAction {
  if (event.resolution !== 'rolled_back') {
    return { kind: 'clear-sleeping', paneKey: event.paneKey }
  }
  const pane = parsePaneKey(event.paneKey)
  return pane && event.ptyId
    ? {
        kind: 'rollback-surface',
        detail: {
          tabId: pane.tabId,
          leafId: pane.leafId,
          preservePty: true,
          retireSurface: true,
          expectedPtyId: event.ptyId
        }
      }
    : { kind: 'ignore' }
}

export function rollbackLegacyWorkerTerminalSurfaceInStore(
  store: TerminalLeafStoreCloseStore,
  detail: CloseTerminalPaneDetail
): 'removed' | 'already-removed' | 'identity-mismatch' {
  const tabExists = Object.values(store.tabsByWorktree).some((tabs) =>
    tabs.some((tab) => tab.id === detail.tabId)
  )
  if (!tabExists) {
    return 'already-removed'
  }
  if (!detail.leafId || !detail.expectedPtyId) {
    return 'identity-mismatch'
  }
  const layout = store.terminalLayoutsByTabId[detail.tabId]
  const boundPtyId = layout?.ptyIdsByLeafId?.[detail.leafId]
  if (!boundPtyId) {
    return 'already-removed'
  }
  if (boundPtyId !== detail.expectedPtyId) {
    return 'identity-mismatch'
  }
  return closeTerminalLeafInStore(store, detail.tabId, detail.leafId, {
    preserveSleepingAgentSession: true
  })
}
