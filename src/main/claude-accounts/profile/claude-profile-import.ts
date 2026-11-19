// Brings what the user picks from their own Claude dir (the system profile) into an account
// profile. Nothing is selected by default for anything that carries accesses, and nothing the
// profile already has is overwritten.
import { cpSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  claudeProfileImportId,
  type ClaudeProfileImportItem,
  type ClaudeProfileImportKind,
  type ClaudeProfileImportResult
} from '../../../shared/claude-profile-types'
import { copyClaudeProfileEntry } from './claude-profile-entry-copy'
import { asJsonObject, readJsonObjectFile, updateJsonObjectFile } from './claude-profile-json'
import { importClaudePlugin, listUserScopePlugins, profileHasPlugin } from './claude-plugin-import'

export type ClaudeProfileImportPaths = {
  userConfigDir: string
  /** The user's `.claude.json` (beside the home dir for the default config dir). */
  userStatePath: string
  profileDir: string
}

const FILES: { kind: ClaudeProfileImportKind; file: string }[] = [
  { kind: 'instructions', file: 'CLAUDE.md' },
  { kind: 'settings', file: 'settings.json' },
  { kind: 'keybindings', file: 'keybindings.json' }
]

const FOLDERS: { kind: ClaudeProfileImportKind; folder: string }[] = [
  { kind: 'skill', folder: 'skills' },
  { kind: 'agent', folder: 'agents' },
  { kind: 'command', folder: 'commands' },
  { kind: 'output-style', folder: 'output-styles' }
]

function listEntries(dir: string): string[] {
  try {
    return readdirSync(dir).filter((name) => !name.startsWith('.'))
  } catch {
    return []
  }
}

function profileStatePath(profileDir: string): string {
  return join(profileDir, '.claude.json')
}

function mcpServerNames(statePath: string): string[] {
  return Object.keys(asJsonObject(readJsonObjectFile(statePath)?.mcpServers))
}

function item(
  kind: ClaudeProfileImportKind,
  name: string,
  existsInProfile: boolean
): ClaudeProfileImportItem {
  return {
    id: claudeProfileImportId(kind, name),
    kind,
    name,
    existsInProfile,
    sensitive: kind === 'mcp-server' || kind === 'plugin'
  }
}

/** Everything the user's own Claude dir holds that the profile could take. */
export function listClaudeProfileImportItems(
  paths: ClaudeProfileImportPaths
): ClaudeProfileImportItem[] {
  const { userConfigDir, userStatePath, profileDir } = paths
  const profileMcp = new Set(mcpServerNames(profileStatePath(profileDir)))
  return [
    ...FILES.filter(({ file }) => existsSync(join(userConfigDir, file))).map(({ kind, file }) =>
      item(kind, file, existsSync(join(profileDir, file)))
    ),
    ...FOLDERS.flatMap(({ kind, folder }) =>
      listEntries(join(userConfigDir, folder)).map((name) =>
        item(kind, name, existsSync(join(profileDir, folder, name)))
      )
    ),
    ...mcpServerNames(userStatePath).map((name) => item('mcp-server', name, profileMcp.has(name))),
    ...listUserScopePlugins(userConfigDir).map((id) =>
      item('plugin', id, profileHasPlugin(profileDir, id))
    )
  ]
}

async function importOne(
  entry: ClaudeProfileImportItem,
  paths: ClaudeProfileImportPaths
): Promise<boolean> {
  const { userConfigDir, userStatePath, profileDir } = paths
  const file = FILES.find(({ kind }) => kind === entry.kind)
  if (file) {
    cpSync(join(userConfigDir, file.file), join(profileDir, file.file))
    return true
  }
  const folder = FOLDERS.find(({ kind }) => kind === entry.kind)
  if (folder) {
    // Why: skills are often links into ~/.agents; copy the link, re-aimed from its new folder.
    copyClaudeProfileEntry(
      join(userConfigDir, folder.folder, entry.name),
      join(profileDir, folder.folder, entry.name)
    )
    return true
  }
  if (entry.kind === 'mcp-server') {
    const server = asJsonObject(readJsonObjectFile(userStatePath)?.mcpServers)[entry.name]
    if (!server) {
      return false
    }
    return updateJsonObjectFile(profileStatePath(profileDir), (current) => ({
      ...current,
      mcpServers: { ...asJsonObject(current.mcpServers), [entry.name]: server }
    }))
  }
  return importClaudePlugin({ pluginId: entry.name, userConfigDir, profileDir })
}

/** Imports the chosen items, in listing order (settings before plugins, which edit settings). */
export async function importIntoClaudeProfile(
  paths: ClaudeProfileImportPaths,
  ids: readonly string[]
): Promise<ClaudeProfileImportResult> {
  const wanted = new Set(ids)
  const result: ClaudeProfileImportResult = { imported: [], skipped: [] }
  for (const entry of listClaudeProfileImportItems(paths)) {
    if (!wanted.has(entry.id)) {
      continue
    }
    // Why skip: the profile's own version is the user's newer choice for this account.
    if (entry.existsInProfile || !(await importOne(entry, paths))) {
      result.skipped.push(entry.id)
      continue
    }
    result.imported.push(entry.id)
  }
  return result
}
