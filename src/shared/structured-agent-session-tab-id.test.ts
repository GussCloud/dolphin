import { describe, expect, it } from 'vitest'
import {
  parseStructuredAgentSessionTabId,
  structuredAgentSessionTabId
} from './structured-agent-session-tab-id'

describe('structured agent session tab id', () => {
  it('round-trips a session id', () => {
    expect(parseStructuredAgentSessionTabId(structuredAgentSessionTabId('s-1'))).toBe('s-1')
  })

  it.each([undefined, '', 'tab-1', 'structured-agent-session-'])('rejects %s', (tabId) => {
    expect(parseStructuredAgentSessionTabId(tabId)).toBeNull()
  })
})
