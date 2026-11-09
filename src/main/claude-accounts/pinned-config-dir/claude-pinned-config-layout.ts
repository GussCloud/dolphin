// The config dir a worktree-pinned Claude account launches with. Credentials and `.claude.json`
// (identity, onboarding, trust) are per account; everything the user curates or the CLI keeps
// as history is a link into the user's own config dir, so a pinned worktree does not fork
// Claude's instructions, tools or sessions (global-settings-types keeps that promise for the
// global switch, and a pin must keep it too).
import { existsSync, lstatSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { lock } from 'proper-lockfile'
import { writeFileAtomically } from '../../codex-accounts/fs-utils'
import { mirrorEntry, mirrorWritableFileEntry } from '../../pty/overlay-mirror'

/**
 * Directories are created in the user's config dir when missing, so the CLI writes the
 * shared copy from the first run. Why each one:
 * - projects, todos, file-history, plans: session transcripts and their side state, so
 *   `--resume`, rewind, the AI Vault and usage scans see pinned sessions as Claude ones.
 * - skills, agents, commands, plugins, output-styles: user-level customizations.
 * - ide: lock files IDE extensions publish; without it `/ide` finds nothing.
 */
export const CLAUDE_SHARED_CONFIG_DIRECTORIES = [
  'projects',
  'todos',
  'file-history',
  'plans',
  'skills',
  'agents',
  'commands',
  'plugins',
  'output-styles',
  'ide'
] as const

/**
 * Files are linked only when the user has them. settings.json carries Dolphin's status hooks
 * and usage statusline as well as the user's own settings; history.jsonl is prompt history.
 */
export const CLAUDE_SHARED_CONFIG_FILES = [
  'settings.json',
  'CLAUDE.md',
  'keybindings.json',
  'history.jsonl'
] as const

/** Top-level `.claude.json` keys copied from the user's config on every launch. */
const SHARED_STATE_KEYS = [
  'hasCompletedOnboarding',
  'lastOnboardingVersion',
  'theme',
  'mcpServers',
  'bypassPermissionsModeAccepted',
  'editorMode',
  'preferredNotifChannel',
  'autoUpdates',
  'verbose'
] as const

const LOCK_RETRIES = { retries: 20, factor: 1.3, minTimeout: 10, maxTimeout: 250, randomize: true }

export type ClaudeSharedLinkOutcome = { name: string; result: 'linked' | 'present' | 'kept-file' }

function isLink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink()
  } catch {
    return false
  }
}

function contentsEqual(a: string, b: string): boolean {
  try {
    return readFileSync(a).equals(readFileSync(b))
  } catch {
    return false
  }
}

/** Links the shared entries of `userConfigDir` into `pinnedConfigDir`; never touches user files. */
export function linkSharedClaudeConfig(
  pinnedConfigDir: string,
  userConfigDir: string
): ClaudeSharedLinkOutcome[] {
  mkdirSync(pinnedConfigDir, { recursive: true })
  const outcomes: ClaudeSharedLinkOutcome[] = []
  for (const name of CLAUDE_SHARED_CONFIG_DIRECTORIES) {
    const source = join(userConfigDir, name)
    const target = join(pinnedConfigDir, name)
    mkdirSync(source, { recursive: true })
    if (existsSync(target) || isLink(target)) {
      // Why: a real directory here holds pinned-session data; replacing it would lose it.
      outcomes.push({ name, result: isLink(target) ? 'present' : 'kept-file' })
      continue
    }
    mirrorEntry(source, target)
    outcomes.push({ name, result: 'linked' })
  }
  for (const name of CLAUDE_SHARED_CONFIG_FILES) {
    const source = join(userConfigDir, name)
    const target = join(pinnedConfigDir, name)
    if (!existsSync(source)) {
      continue
    }
    if (isLink(target)) {
      outcomes.push({ name, result: 'present' })
      continue
    }
    if (existsSync(target)) {
      // Why: an atomic rewrite by the CLI replaces the link with a file; re-link only when
      // nothing would be lost, otherwise the pinned copy keeps its own edits.
      if (!contentsEqual(source, target)) {
        outcomes.push({ name, result: 'kept-file' })
        continue
      }
      unlinkSync(target)
    }
    mirrorWritableFileEntry(source, target)
    outcomes.push({ name, result: 'linked' })
  }
  return outcomes
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

function asObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {}
}

/** The pinned `.claude.json`: its own state, the user's shared keys and trust, the pinned identity. */
export function mergePinnedClaudeState(
  pinned: JsonObject,
  user: JsonObject,
  oauthAccount: unknown
): JsonObject {
  const next: JsonObject = { ...pinned }
  for (const key of SHARED_STATE_KEYS) {
    if (key in user) {
      next[key] = user[key]
    }
  }
  // Why: a fresh config dir opens the theme picker, which swallows Dolphin's injected prompt.
  next.hasCompletedOnboarding = true
  const pinnedProjects = asObject(pinned.projects)
  const projects: JsonObject = { ...pinnedProjects }
  for (const [path, entry] of Object.entries(asObject(user.projects))) {
    const own = asObject(pinnedProjects[path])
    const shared = asObject(entry)
    projects[path] = {
      ...shared,
      ...own,
      hasTrustDialogAccepted:
        own.hasTrustDialogAccepted === true || shared.hasTrustDialogAccepted === true
    }
  }
  next.projects = projects
  if (oauthAccount && typeof oauthAccount === 'object') {
    next.oauthAccount = oauthAccount
  } else {
    // Why: never let another identity's account card describe this pinned home.
    delete next.oauthAccount
  }
  return next
}

/** Rewrites the pinned `.claude.json` under Claude's own lock. A malformed file is left alone. */
export async function seedPinnedClaudeState(args: {
  pinnedConfigPath: string
  userConfigPath: string
  oauthAccount: unknown
}): Promise<void> {
  const user = readJsonObject(args.userConfigPath) ?? {}
  if (!existsSync(args.pinnedConfigPath)) {
    writeFileAtomically(args.pinnedConfigPath, '{}\n', { mode: 0o600 })
  }
  // Why: Claude Code rewrites this file under proper-lockfile (`<config>.lock`).
  const release = await lock(args.pinnedConfigPath, { realpath: false, retries: LOCK_RETRIES })
  try {
    const pinned = readJsonObject(args.pinnedConfigPath)
    if (!pinned) {
      return
    }
    const next = mergePinnedClaudeState(pinned, user, args.oauthAccount)
    const serialized = `${JSON.stringify(next, null, 2)}\n`
    if (readFileSync(args.pinnedConfigPath, 'utf-8') !== serialized) {
      writeFileAtomically(args.pinnedConfigPath, serialized, { mode: 0o600 })
    }
  } finally {
    await release()
  }
}
