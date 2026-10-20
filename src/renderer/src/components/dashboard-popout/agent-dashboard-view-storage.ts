export type AgentDashboardView = 'board' | 'graph'

export const AGENT_DASHBOARD_VIEW_STORAGE_KEY = 'dolphin.agent-dashboard.view.v1'

function getStorage(): Storage | null {
  try {
    return globalThis.localStorage === undefined ? null : globalThis.localStorage
  } catch {
    return null
  }
}

/** The drawer unmounts on close, so the chosen view is kept across reopens. */
export function readAgentDashboardView(): AgentDashboardView {
  try {
    return getStorage()?.getItem(AGENT_DASHBOARD_VIEW_STORAGE_KEY) === 'graph' ? 'graph' : 'board'
  } catch {
    return 'board'
  }
}

export function writeAgentDashboardView(view: AgentDashboardView): void {
  try {
    getStorage()?.setItem(AGENT_DASHBOARD_VIEW_STORAGE_KEY, view)
  } catch {
    // The board stays usable when browser storage is unavailable or full.
  }
}
