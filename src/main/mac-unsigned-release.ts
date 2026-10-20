import { existsSync } from 'node:fs'
import path from 'node:path'

/** Written into Contents/Resources by afterPack for the unsigned CI release (DOLPHIN_MAC_UNSIGNED_RELEASE). */
export const MAC_UNSIGNED_RELEASE_MARKER = 'dolphin-unsigned-mac-release'

export const MAC_UNSIGNED_RELEASE_MESSAGE =
  'This copy of Dolphin for macOS is not signed by Apple, so it cannot install updates itself. Download the new .dmg from the release page and drag Dolphin to Applications to update.'

let cached: boolean | undefined

/** Squirrel.Mac only installs an update whose signature matches the running app, which an ad-hoc build never has. */
export function isUnsignedMacRelease(): boolean {
  if (cached === undefined) {
    const resourcesPath: unknown = process.resourcesPath
    cached =
      process.platform === 'darwin' &&
      typeof resourcesPath === 'string' &&
      existsSync(path.join(resourcesPath, MAC_UNSIGNED_RELEASE_MARKER))
  }
  return cached
}
