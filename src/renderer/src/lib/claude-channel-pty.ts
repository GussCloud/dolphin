import { isRemoteRuntimePtyId } from '@/runtime/runtime-terminal-inspection'

const MAX_KNOWN = 500
const known = new Map<string, boolean | 'unknown'>()

/**
 * Whether main launched this PTY with the Claude channel flags, so its development-channels dialog
 * may hold a draft paste. `unknown` until main answers: callers hold through it rather than paste
 * blind into a first-launch dialog. A failed query, a remote PTY, or a host without the Telegram
 * bridge answer false.
 */
export function isClaudeChannelPtyKnown(ptyId: string | null | undefined): boolean | 'unknown' {
  if (!ptyId || isRemoteRuntimePtyId(ptyId)) {
    return false
  }
  const cached = known.get(ptyId)
  if (cached !== undefined) {
    return cached
  }
  const query = window.api?.telegram?.isClaudeChannelPty
  if (typeof query !== 'function') {
    return false
  }
  known.set(ptyId, 'unknown')
  if (known.size > MAX_KNOWN) {
    const oldest = known.keys().next().value
    if (oldest !== undefined) {
      known.delete(oldest)
    }
  }
  void query(ptyId)
    .then((flagged) => known.set(ptyId, flagged === true))
    .catch(() => known.set(ptyId, false))
  return 'unknown'
}
