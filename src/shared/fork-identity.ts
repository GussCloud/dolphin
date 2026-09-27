/**
 * The identity this fork ships under, so it installs and runs beside the official Orca without
 * sharing its install dir, data, daemon, taskbar identity, or update feed.
 * Mirrored in fork-identity.json for the CommonJS electron-builder config; a test keeps them equal.
 */
export const FORK_IDENTITY = {
  productName: 'Dolphin',
  appId: 'com.gusscloud.dolphin',
  executableName: 'Dolphin',
  userDataDirName: 'dolphin',
  cliAliasName: 'dolphin',
  installerArtifactBaseName: 'dolphin-windows-setup',
  releaseOwner: 'GussCloud',
  releaseRepo: 'orca'
} as const

export const FORK_RELEASES_URL = `https://github.com/${FORK_IDENTITY.releaseOwner}/${FORK_IDENTITY.releaseRepo}/releases`
