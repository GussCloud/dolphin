import { isRemoteRuntimePtyId } from '@/runtime/runtime-terminal-inspection'

const MAX_KNOWN = 500
const known = new Map<string, boolean>()

/**
 * Whether main launched this PTY with the Claude channel flags, so its development-channels dialog
 * may hold a draft paste. Sync for scanners: false until main answers (well before Claude paints the
 * dialog), and always false on hosts without the Telegram bridge.
 */
export function isClaudeChannelPtyKnown(ptyId: string | null | undefined): boolean {
  if (!ptyId || isRemoteRuntimePtyId(ptyId)) {
    return false
  }
  const cached = known.get(ptyId)
  if (cached !== undefined) {
    return cached
  }
  known.set(ptyId, false)
  if (known.size > MAX_KNOWN) {
    const oldest = known.keys().next().value
    if (oldest !== undefined) {
      known.delete(oldest)
    }
  }
  const query = window.api?.telegram?.isClaudeChannelPty
  if (typeof query === 'function') {
    void query(ptyId)
      .then((flagged) => known.set(ptyId, flagged === true))
      .catch(() => {})
  }
  return false
}
