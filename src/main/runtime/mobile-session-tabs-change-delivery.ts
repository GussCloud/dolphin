import { isDeepStrictEqual } from 'node:util'
import type { RuntimeMobileSessionTabsResult } from '../../shared/runtime-types'

/**
 * Why: a headed host's renderer restates, at its own newer version, state main already published
 * from live PTY state (a title main tracks before the renderer graph catches up). The runtime
 * marks an emit whose every coalesced edge was such a renderer graph restatement, and each
 * subscription drops it when its own client payload would differ from the last one it sent only
 * by `snapshotVersion`. Main-local touches (status heartbeats, PTY titles, lifecycle) are never
 * marked, so a freshness re-send always ships.
 */
export type MobileSessionTabsChangeDelivery = {
  rendererRestatement?: true
}

export type MobileSessionTabsChangeListener = (
  snapshot: RuntimeMobileSessionTabsResult,
  changeSequence: number,
  delivery?: MobileSessionTabsChangeDelivery
) => void

/** True when `next` would only repeat `previous` to this client under a newer version. */
export function isSnapshotVersionOnlyRepublish(
  previous: RuntimeMobileSessionTabsResult | undefined,
  next: RuntimeMobileSessionTabsResult,
  delivery: MobileSessionTabsChangeDelivery | undefined
): boolean {
  if (
    delivery?.rendererRestatement !== true ||
    previous === undefined ||
    next.navigationIntent !== undefined ||
    ('removed' in next && next.removed === true)
  ) {
    return false
  }
  return isDeepStrictEqual(
    { ...previous, snapshotVersion: 0, navigationIntent: undefined },
    { ...next, snapshotVersion: 0, navigationIntent: undefined }
  )
}

/** A buffered change folded over an earlier one stays suppressible only if both were. */
export function foldMobileSessionTabsChangeDelivery(
  earlier: { delivery?: MobileSessionTabsChangeDelivery } | undefined,
  next: MobileSessionTabsChangeDelivery | undefined
): MobileSessionTabsChangeDelivery | undefined {
  return earlier?.delivery?.rendererRestatement === true ? next : undefined
}
