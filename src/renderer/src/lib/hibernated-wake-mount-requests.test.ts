import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SleepingAgentSessionRecord } from '../../../shared/agent-session-resume'

const store = vi.hoisted(() => {
  const sleepingAgentSessionsByPaneKey: Record<string, unknown> = {}
  return { state: { sleepingAgentSessionsByPaneKey } }
})

vi.mock('@/store', () => ({
  useAppStore: { getState: () => store.state }
}))

import {
  getHibernatedWakeMountRequests,
  requestHibernatedWakeMount,
  resetHibernatedWakeMountRequestsForTest,
  selectPendingHibernatedWakeMountTabIds,
  subscribeHibernatedWakeMountRequests
} from './hibernated-wake-mount-requests'

function sleepingRecord(paneKey: string): SleepingAgentSessionRecord {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the registry reads only paneKey and identity.
  return { paneKey } as SleepingAgentSessionRecord
}

describe('hibernated wake mount requests', () => {
  afterEach(() => {
    resetHibernatedWakeMountRequestsForTest()
    store.state = { sleepingAgentSessionsByPaneKey: {} }
  })

  it('keeps a request pending only while its exact record is in the store', () => {
    const record = sleepingRecord('tab-h:leaf')
    const listener = vi.fn()
    subscribeHibernatedWakeMountRequests(listener)
    requestHibernatedWakeMount('tab-h', record)
    expect(listener).toHaveBeenCalledTimes(1)
    const requests = getHibernatedWakeMountRequests()

    expect(selectPendingHibernatedWakeMountTabIds(requests, { 'tab-h:leaf': record })).toEqual(
      new Set(['tab-h'])
    )
    // Why identity: a re-hibernation writes a new record that must not inherit this wake.
    expect(
      selectPendingHibernatedWakeMountTabIds(requests, { 'tab-h:leaf': { ...record } }).size
    ).toBe(0)
    expect(selectPendingHibernatedWakeMountTabIds(requests, {}).size).toBe(0)
  })

  it('prunes consumed requests and deduplicates repeated ones on the next request', () => {
    const consumed = sleepingRecord('tab-a:leaf')
    const live = sleepingRecord('tab-b:leaf')
    store.state = { sleepingAgentSessionsByPaneKey: { 'tab-b:leaf': live } }
    requestHibernatedWakeMount('tab-a', consumed)
    requestHibernatedWakeMount('tab-b', live)
    requestHibernatedWakeMount('tab-b', live)

    const requests = getHibernatedWakeMountRequests()
    expect(Array.from(requests.keys())).toEqual(['tab-b'])
    expect(requests.get('tab-b')).toHaveLength(1)
  })
})
