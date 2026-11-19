import { describe, expect, it } from 'vitest'
import { DESIGN_AGENT_BIND_TIMEOUT_MS, isDesignAgentMissing } from './design-agent-missing'

const NOW = 1_000_000_000
const stuck = {
  status: 'draft' as const,
  paneKey: null,
  createdAt: NOW - DESIGN_AGENT_BIND_TIMEOUT_MS - 1
}

describe('isDesignAgentMissing', () => {
  it('flags an unbound draft older than the bind timeout', () => {
    expect(isDesignAgentMissing(stuck, NOW)).toBe(true)
  })

  it('waits the full timeout before flagging', () => {
    expect(
      isDesignAgentMissing({ ...stuck, createdAt: NOW - DESIGN_AGENT_BIND_TIMEOUT_MS }, NOW)
    ).toBe(false)
  })

  it('ignores designs whose agent bound a terminal', () => {
    expect(isDesignAgentMissing({ ...stuck, paneKey: 'tab:1' }, NOW)).toBe(false)
  })

  it('ignores designs that left Draft', () => {
    expect(isDesignAgentMissing({ ...stuck, status: 'discarded' }, NOW)).toBe(false)
    expect(isDesignAgentMissing({ ...stuck, status: 'in-progress' }, NOW)).toBe(false)
  })
})
