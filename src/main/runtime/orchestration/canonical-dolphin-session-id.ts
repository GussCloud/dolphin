import type { DolphinSessionId } from '../../../shared/dolphin-session-address'

/** The Dolphin session id orchestration addresses a session by; every session-to-party step calls this. */
export function canonicalDolphinSessionId(dolphinSessionId: DolphinSessionId): DolphinSessionId {
  // Later lineage canonicalization (a `/clear`ed session to its lineage root) plugs in here.
  return dolphinSessionId
}
