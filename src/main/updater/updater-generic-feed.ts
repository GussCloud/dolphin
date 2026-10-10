import { getUpdateChannelForTarget } from '../../shared/release-channel'

export type GenericReleaseFeed = { provider: 'generic'; url: string; channel?: string }

/** A release-download feed that reads the update manifest this build's platform and arch publish. */
export function genericReleaseFeed(
  url: string,
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch
): GenericReleaseFeed {
  const channel = getUpdateChannelForTarget(platform, arch)
  // Why on the feed, not autoUpdater.channel: that setter also forces allowDowngrade on.
  return channel ? { provider: 'generic', url, channel } : { provider: 'generic', url }
}
