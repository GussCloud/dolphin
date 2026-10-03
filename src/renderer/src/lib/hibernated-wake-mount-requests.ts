import { useAppStore } from '@/store'
import type { SleepingAgentSessionRecord } from '../../../shared/agent-session-resume'

/**
 * Tabs a background (mobile) wake asked to mount so their hibernated panes can cold-restore.
 * Why a registry: hibernated tabs may be parked, and a park verdict renders no pane — so the wake
 * would never reach a PTY. A request counts only while the exact record it was made for is still
 * in the store: the cold-restore spawn clears that record, and a later re-hibernation writes a
 * new one that must not inherit this wake.
 */
export type HibernatedWakeMountRequest = { paneKey: string; record: SleepingAgentSessionRecord }
export type HibernatedWakeMountRequests = ReadonlyMap<string, readonly HibernatedWakeMountRequest[]>

type SleepingRecords = Readonly<Record<string, SleepingAgentSessionRecord>> | undefined

const EMPTY_TAB_IDS: ReadonlySet<string> = new Set()
const listeners = new Set<() => void>()
let requestsByTabId: HibernatedWakeMountRequests = new Map()

function isPending(request: HibernatedWakeMountRequest, records: SleepingRecords): boolean {
  return records?.[request.paneKey] === request.record
}

export function requestHibernatedWakeMount(
  tabId: string,
  record: SleepingAgentSessionRecord
): void {
  const records = useAppStore.getState().sleepingAgentSessionsByPaneKey
  // Why prune here: requests are rare, so this bounds the registry without a store subscription.
  const next = new Map<string, readonly HibernatedWakeMountRequest[]>()
  for (const [id, requests] of requestsByTabId) {
    const pending = requests.filter((request) => isPending(request, records))
    if (pending.length > 0) {
      next.set(id, pending)
    }
  }
  const existing = next.get(tabId) ?? []
  if (!existing.some((request) => request.record === record)) {
    next.set(tabId, [...existing, { paneKey: record.paneKey, record }])
  }
  requestsByTabId = next
  for (const listener of listeners) {
    listener()
  }
}

export function getHibernatedWakeMountRequests(): HibernatedWakeMountRequests {
  return requestsByTabId
}

export function subscribeHibernatedWakeMountRequests(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function selectPendingHibernatedWakeMountTabIds(
  requests: HibernatedWakeMountRequests,
  records: SleepingRecords
): ReadonlySet<string> {
  if (requests.size === 0) {
    return EMPTY_TAB_IDS
  }
  let pendingTabIds: Set<string> | null = null
  for (const [tabId, tabRequests] of requests) {
    if (tabRequests.some((request) => isPending(request, records))) {
      pendingTabIds ??= new Set()
      pendingTabIds.add(tabId)
    }
  }
  return pendingTabIds ?? EMPTY_TAB_IDS
}

export function resetHibernatedWakeMountRequestsForTest(): void {
  requestsByTabId = new Map()
}
