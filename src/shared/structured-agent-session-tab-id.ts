const STRUCTURED_AGENT_SESSION_TAB_PREFIX = 'structured-agent-session-'

export function structuredAgentSessionTabId(sessionId: string): string {
  return `${STRUCTURED_AGENT_SESSION_TAB_PREFIX}${sessionId}`
}

/** Inverse of `structuredAgentSessionTabId`; null for terminal tabs. */
export function parseStructuredAgentSessionTabId(tabId: string | undefined): string | null {
  return tabId?.startsWith(STRUCTURED_AGENT_SESSION_TAB_PREFIX) &&
    tabId.length > STRUCTURED_AGENT_SESSION_TAB_PREFIX.length
    ? tabId.slice(STRUCTURED_AGENT_SESSION_TAB_PREFIX.length)
    : null
}
