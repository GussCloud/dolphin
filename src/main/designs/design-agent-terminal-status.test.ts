import { describe, expect, it } from 'vitest'
import { designAgentStatusFromTerminal } from './design-agent-terminal-status'

describe('designAgentStatusFromTerminal', () => {
  it('reads a monitoring agent as idle, so the inbox notice can be typed', () => {
    expect(designAgentStatusFromTerminal({ status: 'working', workingMode: 'monitoring' })).toBe(
      'idle'
    )
  })

  it('keeps every other status as the terminal reports it', () => {
    expect(designAgentStatusFromTerminal({ status: 'working' })).toBe('working')
    expect(designAgentStatusFromTerminal({ status: 'permission' })).toBe('permission')
    expect(designAgentStatusFromTerminal({ status: 'idle' })).toBe('idle')
    expect(designAgentStatusFromTerminal({ status: null })).toBeNull()
  })
})
