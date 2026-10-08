/**
 * Which panes and PTYs Dolphin launched with the Claude channel flags. The grant (pane -> launch
 * token hash) authenticates the channel server; the PTY mark scopes the development-channels
 * dialog guard to the exact spawn that can show that dialog.
 */
import { createHash, timingSafeEqual } from 'node:crypto'

const MAX_ENTRIES = 512

const grantsByPaneKey = new Map<string, Buffer>()
const channelPtyIds = new Set<string>()

function hashLaunchToken(token: string): Buffer {
  return createHash('sha256').update(token.trim()).digest()
}

function readPaneLaunch(
  env: Record<string, string> | undefined
): { paneKey: string; launchToken: string } | null {
  const paneKey = env?.DOLPHIN_PANE_KEY
  const launchToken = env?.DOLPHIN_AGENT_LAUNCH_TOKEN?.trim()
  return paneKey && launchToken ? { paneKey, launchToken } : null
}

function evictOldest<T>(entries: Map<string, T> | Set<string>): void {
  if (entries.size > MAX_ENTRIES) {
    const oldest = entries.keys().next().value
    if (oldest !== undefined) {
      entries.delete(oldest)
    }
  }
}

/** Recorded where the flags are spliced, from the spawn env's validated pane key and token. */
export function grantClaudeChannelPane(env: Record<string, string> | undefined): void {
  const launch = readPaneLaunch(env)
  if (!launch) {
    return
  }
  grantsByPaneKey.delete(launch.paneKey)
  grantsByPaneKey.set(launch.paneKey, hashLaunchToken(launch.launchToken))
  evictOldest(grantsByPaneKey)
}

/**
 * True when Dolphin launched this pane's Claude with the channel and this launch token. Why not
 * only hook commitments: Claude's first status hook comes with the first prompt, and a channel
 * must work in a pane the user opened and walked away from.
 */
export function isClaudeChannelLaunchGranted(paneKey: string, launchToken: string): boolean {
  const expected = grantsByPaneKey.get(paneKey)
  const actual = launchToken.trim() ? hashLaunchToken(launchToken) : null
  return Boolean(expected && actual && timingSafeEqual(expected, actual))
}

/** At spawn commit: marks the PTY when its env carries the very launch the grant was minted for. */
export function markClaudeChannelPty(ptyId: string, env: Record<string, string> | undefined): void {
  const launch = readPaneLaunch(env)
  if (launch && isClaudeChannelLaunchGranted(launch.paneKey, launch.launchToken)) {
    channelPtyIds.add(ptyId)
    evictOldest(channelPtyIds)
  }
}

/** Only these PTYs can show Claude's development-channels confirmation. */
export function isClaudeChannelPty(ptyId: string | null | undefined): boolean {
  return Boolean(ptyId && channelPtyIds.has(ptyId))
}
