import { isDolphinSessionId, type DolphinSessionId } from './dolphin-session-address'

/** A literal Dolphin session id for a test, checked by the same predicate production uses. */
export function testDolphinSessionId(id: string): DolphinSessionId {
  if (!isDolphinSessionId(id)) {
    throw new Error(`Not a Dolphin session id: ${id}`)
  }
  return id
}
