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
  cliCommandName: 'dolphin',
  // Why -ide on Linux: KDE Dolphin owns /usr/bin/dolphin, as GNOME Orca owns /usr/bin/orca.
  linuxCliCommandName: 'dolphin-ide',
  // Why still orca-dev: contributor tooling (package.json bin, dev profile dir) owns this name.
  devCliCommandName: 'orca-dev',
  installerArtifactBaseName: 'dolphin-windows-setup',
  releaseOwner: 'GussCloud',
  releaseRepo: 'dolphin'
} as const

export const FORK_REPOSITORY_SLUG = `${FORK_IDENTITY.releaseOwner}/${FORK_IDENTITY.releaseRepo}`
export const FORK_REPOSITORY_URL = `https://github.com/${FORK_REPOSITORY_SLUG}`
export const FORK_ISSUES_URL = `${FORK_REPOSITORY_URL}/issues`
export const FORK_RELEASES_URL = `${FORK_REPOSITORY_URL}/releases`

// Why one origin: docs, changelog feeds, and the plugin safety list are static files on the
// fork's own site; every fetch below already treats an unreachable URL as "nothing to show".
export const FORK_WEB_ORIGIN = 'https://dolphin.guss.dev.br'
export const FORK_WEB_URLS = {
  docs: `${FORK_WEB_ORIGIN}/docs`,
  whatsNewChangelog: `${FORK_WEB_ORIGIN}/whats-new/changelog.json`,
  whatsNewNudge: `${FORK_WEB_ORIGIN}/whats-new/nudge.json`,
  pluginKillList: `${FORK_WEB_ORIGIN}/plugins/kill-list.json`,
  telemetryPrivacy: `${FORK_WEB_ORIGIN}/docs/telemetry`
} as const

/** Per-user home state dir (hooks, credentials). Never Orca's `~/.orca`, which a side-by-side Orca owns. */
export const FORK_HOME_STATE_DIR_NAME = `.${FORK_IDENTITY.userDataDirName}`

/** Cloud services the fork hosts itself; every host sits under this domain. */
export const FORK_CLOUD_DOMAIN = 'dolphin.guss.dev.br'
export const FORK_CLOUD_ORIGINS = {
  auth: `https://auth.${FORK_CLOUD_DOMAIN}`,
  relay: `https://relay.${FORK_CLOUD_DOMAIN}`,
  push: `https://push.${FORK_CLOUD_DOMAIN}`,
  share: `https://share.${FORK_CLOUD_DOMAIN}`,
  api: `https://api.${FORK_CLOUD_DOMAIN}`
} as const

export function isForkCloudHost(hostname: string): boolean {
  return hostname === FORK_CLOUD_DOMAIN || hostname.endsWith(`.${FORK_CLOUD_DOMAIN}`)
}
