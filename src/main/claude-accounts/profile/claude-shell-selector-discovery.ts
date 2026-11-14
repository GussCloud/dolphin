// Finds Claude config dirs a user already manages with a zsh `claude` function (a terminal menu
// that sets CLAUDE_CONFIG_DIR). Read-only: nothing here writes to the user's files or dirs.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import { DEEPSEEK_CLAUDE_CONFIG_DIR_NAME } from '../../../shared/deepseek-claude-provider'

const ZSH_STARTUP_FILES = ['.zshenv', '.zprofile', '.zshrc', '.zlogin'] as const
const MAX_SCANNED_FILE_BYTES = 512 * 1024
const MAX_SOURCED_FILES = 32

export type ClaudeConfigFolderIdentity = {
  email: string | null
  organizationName: string | null
  organizationUuid: string | null
}

export type ClaudeConfigFolderCandidate = ClaudeConfigFolderIdentity & {
  configDir: string
  /** `~/.claude`: Claude's own default, launched without CLAUDE_CONFIG_DIR. */
  isDefault: boolean
}

export type ClaudeShellSelectorDiscovery = {
  /** The zsh file that defines a `claude` function, when one does. */
  selectorFile: string | null
  folders: ClaudeConfigFolderCandidate[]
}

function readSmallText(path: string): string | null {
  try {
    const stat = statSync(path)
    return stat.isFile() && stat.size <= MAX_SCANNED_FILE_BYTES ? readFileSync(path, 'utf-8') : null
  } catch {
    return null
  }
}

/** Expands `~`, `$HOME` and `${HOME}` and strips quotes; null for anything still dynamic. */
export function expandShellPath(raw: string, home: string): string | null {
  const unquoted = raw.trim().replace(/^(["'])(.*)\1$/, '$2')
  const expanded = unquoted
    .replace(/^~(?=\/|$)/, home)
    .replace(/\$\{HOME\}|\$HOME(?![A-Za-z0-9_])/g, home)
  if (!expanded || /[$`*?]/.test(expanded) || !isAbsolute(expanded)) {
    return null
  }
  return resolve(expanded)
}

function sourcedFiles(content: string, home: string): string[] {
  const files: string[] = []
  const pattern = /(?:^|[;&|{(\s])(?:source|\.)\s+("[^"\n]+"|'[^'\n]+'|[^\s;&|)]+)/gm
  for (const match of content.matchAll(pattern)) {
    const path = expandShellPath(match[1], home)
    if (path) {
      files.push(path)
    }
  }
  return files
}

function definesClaudeFunction(content: string): boolean {
  return /^\s*(?:function\s+claude\b|claude\s*\(\s*\))/m.test(content)
}

/** Every path in the selector that names a Claude config dir. */
function referencedConfigDirs(content: string, home: string): string[] {
  const dirs: string[] = []
  const assignment = /CLAUDE_CONFIG_DIR=("[^"\n]*"|'[^'\n]*'|[^\s;&|)]+)/g
  for (const match of content.matchAll(assignment)) {
    const path = expandShellPath(match[1], home)
    if (path) {
      dirs.push(path)
    }
  }
  // Why: menus often keep the dirs in an array or case arm and assign `CLAUDE_CONFIG_DIR=$dir`.
  const pathToken = /(?:~|\$\{HOME\}|\$HOME)\/\.claude[A-Za-z0-9._-]*/g
  for (const match of content.matchAll(pathToken)) {
    const path = expandShellPath(match[0], home)
    if (path) {
      dirs.push(path)
    }
  }
  return dirs
}

/** Claude keeps the default dir's state in `~/.claude.json`, any other dir's inside the dir. */
export function claudeConfigStatePath(configDir: string, home: string = homedir()): string {
  return resolve(configDir) === resolve(home, '.claude')
    ? join(home, '.claude.json')
    : join(configDir, '.claude.json')
}

function looksLikeClaudeConfigDir(dir: string, home: string): boolean {
  try {
    if (!statSync(dir).isDirectory()) {
      return false
    }
  } catch {
    return false
  }
  return (
    existsSync(claudeConfigStatePath(dir, home)) ||
    ['settings.json', 'projects', '.credentials.json'].some((entry) => existsSync(join(dir, entry)))
  )
}

function field(value: Record<string, unknown>, key: string): string | null {
  const raw = value[key]
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null
}

/** The account the CLI last logged into in `configDir`, from its own state file. */
export function readClaudeConfigFolderIdentity(
  configDir: string,
  home: string = homedir()
): ClaudeConfigFolderIdentity {
  const empty = { email: null, organizationName: null, organizationUuid: null }
  const text = readSmallText(claudeConfigStatePath(configDir, home))
  if (!text) {
    return empty
  }
  try {
    const parsed: unknown = JSON.parse(text)
    const oauth =
      parsed && typeof parsed === 'object' && 'oauthAccount' in parsed ? parsed.oauthAccount : null
    if (!oauth || typeof oauth !== 'object') {
      return empty
    }
    const record = Object.fromEntries(Object.entries(oauth))
    return {
      email: field(record, 'emailAddress'),
      organizationName: field(record, 'organizationName'),
      organizationUuid: field(record, 'organizationUuid')
    }
  } catch {
    return empty
  }
}

export function describeClaudeConfigFolder(
  configDir: string,
  home: string = homedir()
): ClaudeConfigFolderCandidate {
  const resolved = resolve(configDir)
  return {
    configDir: resolved,
    isDefault: resolved === resolve(home, '.claude'),
    ...readClaudeConfigFolderIdentity(resolved, home)
  }
}

/** True when `dir` can be linked as a Claude account folder. */
export function isLinkableClaudeConfigDir(dir: string, home: string = homedir()): boolean {
  const resolved = resolve(dir)
  return (
    resolved !== resolve(home, DEEPSEEK_CLAUDE_CONFIG_DIR_NAME) &&
    looksLikeClaudeConfigDir(resolved, home)
  )
}

export function discoverClaudeShellSelector(
  home: string = homedir()
): ClaudeShellSelectorDiscovery {
  const queue = ZSH_STARTUP_FILES.map((name) => join(home, name))
  const seen = new Set<string>()
  let selectorFile: string | null = null
  const dirs: string[] = []
  while (queue.length > 0 && seen.size < MAX_SOURCED_FILES) {
    const file = queue.shift()
    if (!file || seen.has(file)) {
      continue
    }
    seen.add(file)
    const content = readSmallText(file)
    if (content === null) {
      continue
    }
    if (definesClaudeFunction(content)) {
      selectorFile ??= file
      dirs.push(...referencedConfigDirs(content, home))
    }
    // Why one level: rc files source the selector; deeper chains are plugin managers, not menus.
    if (ZSH_STARTUP_FILES.some((name) => join(home, name) === file)) {
      queue.push(...sourcedFiles(content, home))
    }
  }
  if (!selectorFile) {
    return { selectorFile: null, folders: [] }
  }
  // Why: a menu option that leaves CLAUDE_CONFIG_DIR unset runs on the default dir.
  dirs.push(join(home, '.claude'))
  const folders = [...new Set(dirs)]
    .filter((dir) => isLinkableClaudeConfigDir(dir, home))
    .map((dir) => describeClaudeConfigFolder(dir, home))
  return { selectorFile, folders }
}
