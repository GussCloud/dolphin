// Claude Code records plugins with absolute paths (installed_plugins.json, known_marketplaces.json),
// so importing one copies its files into the profile and rewrites those paths to the copies.
import { cpSync, existsSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { asJsonObject, readJsonObjectFile, updateJsonObjectFile } from './claude-profile-json'

type PluginInstall = Record<string, unknown> & { scope?: unknown; installPath?: unknown }

function pluginsDir(configDir: string): string {
  return join(configDir, 'plugins')
}

function userScopeInstall(value: unknown): PluginInstall | null {
  if (!Array.isArray(value)) {
    return null
  }
  const install = value.map(asJsonObject).find((entry) => entry.scope === 'user')
  return install && typeof install.installPath === 'string' ? install : null
}

/** Ids of the plugins installed for the user (not per project) in `configDir`. */
export function listUserScopePlugins(configDir: string): string[] {
  const installed = asJsonObject(
    readJsonObjectFile(join(pluginsDir(configDir), 'installed_plugins.json'))?.plugins
  )
  return Object.entries(installed)
    .filter(([, installs]) => userScopeInstall(installs) !== null)
    .map(([id]) => id)
}

export function profileHasPlugin(profileDir: string, pluginId: string): boolean {
  return listUserScopePlugins(profileDir).includes(pluginId)
}

/** A path inside the user's plugins dir, moved to the profile's (copied once); others are kept. */
function relocate(path: string, userDir: string, profileDir: string): string {
  const from = resolve(path)
  const rel = relative(resolve(pluginsDir(userDir)), from)
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
    return path
  }
  const to = join(pluginsDir(profileDir), rel)
  if (!existsSync(to) && existsSync(from)) {
    // Why verbatim: a plugin may link to shared tooling; copy the link, not its target.
    cpSync(from, to, { recursive: true, verbatimSymlinks: true })
  }
  return to
}

/** Copies one user-scope plugin, its marketplace entry and its enabled flag into the profile. */
export async function importClaudePlugin(args: {
  pluginId: string
  userConfigDir: string
  profileDir: string
}): Promise<boolean> {
  const { pluginId, userConfigDir, profileDir } = args
  const userInstalled = readJsonObjectFile(
    join(pluginsDir(userConfigDir), 'installed_plugins.json')
  )
  const install = userScopeInstall(asJsonObject(userInstalled?.plugins)[pluginId])
  if (!userInstalled || !install || typeof install.installPath !== 'string') {
    return false
  }
  const installPath = relocate(install.installPath, userConfigDir, profileDir)
  const wrote = await updateJsonObjectFile(
    join(pluginsDir(profileDir), 'installed_plugins.json'),
    (current) => ({
      ...current,
      version: current.version ?? userInstalled.version ?? 2,
      plugins: { ...asJsonObject(current.plugins), [pluginId]: [{ ...install, installPath }] }
    })
  )
  if (!wrote) {
    return false
  }
  const marketplace = pluginId.split('@')[1]
  const userMarketplaces = readJsonObjectFile(
    join(pluginsDir(userConfigDir), 'known_marketplaces.json')
  )
  const entry = marketplace ? asJsonObject(userMarketplaces?.[marketplace]) : {}
  if (marketplace && Object.keys(entry).length > 0) {
    const installLocation =
      typeof entry.installLocation === 'string'
        ? relocate(entry.installLocation, userConfigDir, profileDir)
        : entry.installLocation
    await updateJsonObjectFile(
      join(pluginsDir(profileDir), 'known_marketplaces.json'),
      (current) =>
        marketplace in current
          ? current
          : { ...current, [marketplace]: { ...entry, installLocation } }
    )
  }
  await updateJsonObjectFile(join(profileDir, 'settings.json'), (current) => ({
    ...current,
    enabledPlugins: { ...asJsonObject(current.enabledPlugins), [pluginId]: true }
  }))
  return true
}
