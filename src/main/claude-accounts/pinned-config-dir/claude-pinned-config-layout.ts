// Each Dolphin-managed Claude account is an isolated profile: its CLAUDE_CONFIG_DIR is a real
// directory with its own instructions (CLAUDE.md), settings, user-scope MCP servers, skills,
// agents, commands and session history, so one account's accesses never reach another.
// Only credentials come from Dolphin's managed store; see docs/reference/claude-account-profiles.md.
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync
} from 'node:fs'
import { join } from 'node:path'
import { lock } from 'proper-lockfile'
import { writeFileAtomically } from '../../codex-accounts/fs-utils'
import { mirrorEntry } from '../../pty/overlay-mirror'

/** Records that a profile is isolated, and what a migration from the shared layout copied. */
export const CLAUDE_PROFILE_MARKER = '.dolphin-claude-profile.json'

/** Earlier layouts linked these to the user's dir; migration turns each link into an own copy. */
const MIGRATION_COPIED_FILES = ['CLAUDE.md', 'settings.json', 'keybindings.json'] as const
const MIGRATION_COPIED_DIRECTORIES = ['skills', 'agents', 'commands', 'output-styles'] as const

/**
 * History and plugin links are only detached: the sessions stay in the user's own profile where
 * they were written, and plugin caches hold absolute paths that a copy would break.
 */
const MIGRATION_DETACHED_ENTRIES = [
  'projects',
  'todos',
  'file-history',
  'plans',
  'plugins',
  'history.jsonl'
] as const

/** IDE extensions publish their lock files only in the user's dir; `/ide` needs to see them. */
const SHARED_IDE_DIRECTORY = 'ide'

/** `.claude.json` keys a profile takes from the user's file only while it has none of its own. */
const SAFE_DEFAULT_STATE_KEYS = [
  'hasCompletedOnboarding',
  'lastOnboardingVersion',
  'theme',
  'editorMode',
  'preferredNotifChannel',
  'autoUpdates',
  'verbose'
] as const

/** Keys earlier layouts copied from the user's file on every launch; a migration removes them. */
const INHERITED_SHARED_STATE_KEYS = ['mcpServers', 'bypassPermissionsModeAccepted'] as const

const LOCK_RETRIES = { retries: 20, factor: 1.3, minTimeout: 10, maxTimeout: 250, randomize: true }

export type ClaudeProfileIsolation = {
  /** True on the first launch of this layout for the dir (the marker was missing). */
  firstIsolation: boolean
  copied: string[]
  detached: string[]
}

export type ClaudeProfileMarker = {
  version: 1
  migratedAt?: number
  copied?: string[]
  detached?: string[]
  /** Set by a migration from the shared layout until the user reviews the profile. */
  reviewPending?: boolean
}

function isLink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink()
  } catch {
    return false
  }
}

// Why: Windows mirrored shared files as hard links, which lstat reports as plain files.
function isSameFile(a: string, b: string): boolean {
  try {
    const left = statSync(a)
    const right = statSync(b)
    return left.dev === right.dev && left.ino === right.ino
  } catch {
    return false
  }
}

function sharesUserEntry(target: string, source: string): boolean {
  return isLink(target) || (existsSync(source) && isSameFile(target, source))
}

/** Replaces a shared file with an own copy of its current content; never touches the source. */
function copyLinkedFile(target: string): boolean {
  let content: string | null
  try {
    content = readFileSync(target, 'utf-8')
  } catch {
    content = null
  }
  // Why unlink first: writing through the link or hard link would edit the user's own file.
  unlinkSync(target)
  if (content !== null) {
    writeFileAtomically(target, content, { mode: 0o600 })
  }
  return content !== null
}

/** Replaces a linked directory with an own copy; the link itself is removed, never followed. */
function copyLinkedDirectory(target: string, source: string): boolean {
  unlinkSync(target)
  if (!existsSync(source) || !statSync(source).isDirectory()) {
    return false
  }
  // Why verbatim: skills are often links to ~/.agents; copy the link, not what it points to.
  cpSync(source, target, { recursive: true, verbatimSymlinks: true })
  return true
}

function readMarker(profileDir: string): ClaudeProfileMarker | null {
  const parsed = readJsonObject(join(profileDir, CLAUDE_PROFILE_MARKER))
  return parsed && parsed.version === 1 ? { ...parsed, version: 1 } : null
}

/** The profile's isolation marker, or null for a dir this layout has never prepared. */
export function readClaudeProfileMarker(profileDir: string): ClaudeProfileMarker | null {
  return existsSync(join(profileDir, CLAUDE_PROFILE_MARKER)) ? readMarker(profileDir) : null
}

/**
 * Makes `profileDir` an isolated Claude config dir. A dir from the shared layout is migrated:
 * linked instructions, settings and tools become own copies for the user to review, history and
 * plugin links are detached. Nothing under `userConfigDir` is modified or deleted.
 */
export function isolateClaudeProfileDir(
  profileDir: string,
  userConfigDir: string
): ClaudeProfileIsolation {
  mkdirSync(profileDir, { recursive: true, mode: 0o700 })
  const firstIsolation = readClaudeProfileMarker(profileDir) === null
  const copied: string[] = []
  const detached: string[] = []
  for (const name of MIGRATION_COPIED_FILES) {
    const target = join(profileDir, name)
    if (sharesUserEntry(target, join(userConfigDir, name)) && copyLinkedFile(target)) {
      copied.push(name)
    }
  }
  for (const name of MIGRATION_COPIED_DIRECTORIES) {
    const target = join(profileDir, name)
    if (isLink(target) && copyLinkedDirectory(target, join(userConfigDir, name))) {
      copied.push(name)
    }
  }
  for (const name of MIGRATION_DETACHED_ENTRIES) {
    const target = join(profileDir, name)
    if (sharesUserEntry(target, join(userConfigDir, name))) {
      unlinkSync(target)
      detached.push(name)
    }
  }
  const ideSource = join(userConfigDir, SHARED_IDE_DIRECTORY)
  const ideTarget = join(profileDir, SHARED_IDE_DIRECTORY)
  if (!existsSync(ideTarget) && !isLink(ideTarget)) {
    mkdirSync(ideSource, { recursive: true })
    mirrorEntry(ideSource, ideTarget)
  }
  if (firstIsolation || copied.length > 0 || detached.length > 0) {
    const migrated = copied.length > 0 || detached.length > 0
    const marker: ClaudeProfileMarker = migrated
      ? { version: 1, migratedAt: Date.now(), copied, detached, reviewPending: true }
      : (readClaudeProfileMarker(profileDir) ?? { version: 1 })
    writeFileAtomically(
      join(profileDir, CLAUDE_PROFILE_MARKER),
      `${JSON.stringify(marker, null, 2)}\n`,
      { mode: 0o600 }
    )
  }
  return { firstIsolation, copied, detached }
}

type JsonObject = Record<string, unknown>

function readJsonObject(path: string): JsonObject | null {
  if (!existsSync(path)) {
    return {}
  }
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf-8'))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? Object.fromEntries(Object.entries(parsed))
      : null
  } catch {
    return null
  }
}

/**
 * The profile's `.claude.json`: its own state and trust, the account's identity, and only the
 * harmless defaults it does not have yet. `dropInheritedSharedState` removes what the shared
 * layout copied from the user (their MCP servers carry their accesses).
 */
export function mergeClaudeProfileState(
  profile: JsonObject,
  user: JsonObject,
  oauthAccount: unknown,
  options: { dropInheritedSharedState?: boolean } = {}
): JsonObject {
  const next: JsonObject = { ...profile }
  if (options.dropInheritedSharedState) {
    for (const key of INHERITED_SHARED_STATE_KEYS) {
      delete next[key]
    }
  }
  for (const key of SAFE_DEFAULT_STATE_KEYS) {
    if (!(key in next) && key in user) {
      next[key] = user[key]
    }
  }
  // Why: a fresh config dir opens the theme picker, which swallows Dolphin's injected prompt.
  next.hasCompletedOnboarding = true
  if (oauthAccount && typeof oauthAccount === 'object') {
    next.oauthAccount = oauthAccount
  } else {
    // Why: never let another identity's account card describe this profile.
    delete next.oauthAccount
  }
  return next
}

/** Rewrites the profile's `.claude.json` under Claude's own lock. A malformed file is left alone. */
export async function seedClaudeProfileState(args: {
  profileConfigPath: string
  userConfigPath: string
  oauthAccount: unknown
  dropInheritedSharedState?: boolean
}): Promise<void> {
  const user = readJsonObject(args.userConfigPath) ?? {}
  if (!existsSync(args.profileConfigPath)) {
    writeFileAtomically(args.profileConfigPath, '{}\n', { mode: 0o600 })
  }
  // Why: Claude Code rewrites this file under proper-lockfile (`<config>.lock`).
  const release = await lock(args.profileConfigPath, { realpath: false, retries: LOCK_RETRIES })
  try {
    const profile = readJsonObject(args.profileConfigPath)
    if (!profile) {
      return
    }
    const next = mergeClaudeProfileState(profile, user, args.oauthAccount, {
      dropInheritedSharedState: args.dropInheritedSharedState
    })
    const serialized = `${JSON.stringify(next, null, 2)}\n`
    if (readFileSync(args.profileConfigPath, 'utf-8') !== serialized) {
      writeFileAtomically(args.profileConfigPath, serialized, { mode: 0o600 })
    }
  } finally {
    await release()
  }
}
