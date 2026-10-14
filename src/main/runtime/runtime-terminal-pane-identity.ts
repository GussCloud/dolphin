import { AgentLaunchPaneAlreadyLiveError } from '../../shared/agent-launch-pane-already-live'
import { parsePaneKey } from '../../shared/stable-pane-id'

/** A caller-minted `tabId:leafId` as the pair `createTerminal` adopts; an unparsable key yields
 *  nothing, so the runtime mints its own and the reported `paneKey` shows the caller it lost. */
export function paneIdentity(paneKey: string | undefined): { tabId?: string; leafId?: string } {
  const pane = paneKey ? parsePaneKey(paneKey) : null
  return pane ? { tabId: pane.tabId, leafId: pane.leafId } : {}
}

/** Whether spawn attached to a live pane; refused when the caller required a fresh one. */
export function admitStablePaneAdoption(
  result: { stablePaneOwner?: unknown },
  opts: { requireFreshPane?: boolean }
): boolean {
  if (result.stablePaneOwner && opts.requireFreshPane) {
    throw new AgentLaunchPaneAlreadyLiveError()
  }
  return Boolean(result.stablePaneOwner)
}

/** Create-result flags telling callers the spawn attached something already running. */
export function terminalReattachResultFields(
  adoptedStablePane: boolean,
  result: { reattachedLiveSession?: true }
): { isReattach?: true; reattachedLiveSession?: true } {
  return {
    ...(adoptedStablePane ? { isReattach: true as const } : {}),
    ...(result.reattachedLiveSession ? { reattachedLiveSession: true as const } : {})
  }
}
