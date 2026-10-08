import { describe, expect, it } from 'vitest'
import { attach, hostTestState } from './structured-agent-session-host-test-harness'
import { HOST_TEST_SESSION as SESSION } from './structured-agent-session-host-test-data'

describe('sessionFence', () => {
  it('is null before attach and the lease fence once the session is live', async () => {
    const { host } = hostTestState()
    expect(host.sessionFence(SESSION)).toBeNull()
    const record = await attach()
    expect(host.sessionFence(SESSION)).toBe(record?.lease.runtimeFence)
    expect(host.sessionFence('other-session')).toBeNull()
  })
})
