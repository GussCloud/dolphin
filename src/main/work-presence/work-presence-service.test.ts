import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DolphinCloudAuthConfig } from '../dolphin-profiles/profile-cloud-auth-config'

const profileState = vi.hoisted(() => ({ activeId: 'profile-a' }))
const runOrgMemberCall = vi.hoisted(() => vi.fn())

vi.mock('../dolphin-profiles/profile-index-store', () => ({
  ensureActiveDolphinProfile: () => ({ profile: { id: profileState.activeId } })
}))
vi.mock('../dolphin-profiles/profile-cloud-org-members-service', () => ({ runOrgMemberCall }))

import { startWorkPresenceService } from './work-presence-service'

// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: The service only forwards config to the mocked call.
const config = { apiBaseUrl: 'https://api.example' } as DolphinCloudAuthConfig

function start() {
  return startWorkPresenceService({
    config,
    userDataPath: '/user-data',
    getInstallId: () => 'install-1',
    getWorktreePs: async () => ({ worktrees: [], totalCount: 0, truncated: false }),
    subscribeStatusChanges: () => () => {}
  })
}

describe('startWorkPresenceService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    profileState.activeId = 'profile-a'
    runOrgMemberCall.mockReset()
    runOrgMemberCall.mockResolvedValue({ status: 'ok', value: { heartbeatMs: null } })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('says goodbye with the published profile after a profile switch', async () => {
    const service = start()
    await vi.advanceTimersByTimeAsync(0)
    expect(runOrgMemberCall).toHaveBeenCalledTimes(1)
    profileState.activeId = 'profile-b'
    await service.stop()
    expect(runOrgMemberCall).toHaveBeenCalledTimes(2)
    expect(runOrgMemberCall.mock.calls[1][1]).toEqual({ profile: { id: 'profile-a' } })
  })

  it('stops publishing once the index names another profile', async () => {
    const service = start()
    await vi.advanceTimersByTimeAsync(0)
    profileState.activeId = 'profile-b'
    await vi.advanceTimersByTimeAsync(20_000)
    expect(runOrgMemberCall).toHaveBeenCalledTimes(1)
    await service.stop()
  })
})
