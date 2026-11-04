/**
 * Which panes and PTYs Dolphin launched with the Claude channel flags. The grant (pane -> launch
 * token hash) authenticates the channel server; the PTY mark scopes the development-channels
 * dialog guard to the exact spawn that can show that dialog.
 */
import { createHash, timingSafeEqual } from 'node:crypto'

const MAX_ENTRIES = 512

type ChannelGrant = { tokenHash: Buffer; autoConfirmDevChannelsDialog: boolean }

const grantsByPaneKey = new Map<string, ChannelGrant>()
const channelPtyIds = new Set<string>()
const autoConfirmPtyIds = new Set<string>()

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
export function grantClaudeChannelPane(
  env: Record<string, string> | undefined,
  options: { autoConfirmDevChannelsDialog?: boolean } = {}
): void {
  const launch = readPaneLaunch(env)
  if (!launch) {
    return
  }
  grantsByPaneKey.delete(launch.paneKey)
  grantsByPaneKey.set(launch.paneKey, {
    tokenHash: hashLaunchToken(launch.launchToken),
    autoConfirmDevChannelsDialog: options.autoConfirmDevChannelsDialog === true
  })
  evictOldest(grantsByPaneKey)
}

function grantFor(paneKey: string, launchToken: string): ChannelGrant | null {
  const grant = grantsByPaneKey.get(paneKey)
  const actual = launchToken.trim() ? hashLaunchToken(launchToken) : null
  return grant && actual && timingSafeEqual(grant.tokenHash, actual) ? grant : null
}

/**
 * True when Dolphin launched this pane's Claude with the channel and this launch token. Why not
 * only hook commitments: Claude's first status hook comes with the first prompt, and a channel
 * must work in a pane the user opened and walked away from.
 */
export function isClaudeChannelLaunchGranted(paneKey: string, launchToken: string): boolean {
  return grantFor(paneKey, launchToken) !== null
}

/** At spawn commit: marks the PTY when its env carries the very launch the grant was minted for. */
export function markClaudeChannelPty(ptyId: string, env: Record<string, string> | undefined): void {
  const launch = readPaneLaunch(env)
  const grant = launch ? grantFor(launch.paneKey, launch.launchToken) : null
  if (grant) {
    channelPtyIds.add(ptyId)
    evictOldest(channelPtyIds)
    if (grant.autoConfirmDevChannelsDialog) {
      autoConfirmPtyIds.add(ptyId)
      evictOldest(autoConfirmPtyIds)
    }
  }
}

/** PTYs whose development-channels confirmation Dolphin answers itself (goal coordinators). */
export function isClaudeChannelAutoConfirmPty(ptyId: string): boolean {
  return autoConfirmPtyIds.has(ptyId)
}

/** Once answered (or the PTY is gone) the confirmation cannot come back for this spawn. */
export function releaseClaudeChannelAutoConfirmPty(ptyId: string): void {
  autoConfirmPtyIds.delete(ptyId)
}

/** Only these PTYs can show Claude's development-channels confirmation. */
export function isClaudeChannelPty(ptyId: string | null | undefined): boolean {
  return Boolean(ptyId && channelPtyIds.has(ptyId))
}
