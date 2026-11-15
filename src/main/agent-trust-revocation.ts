// Drops the per-worktree trust entries Dolphin pre-wrote for agent CLIs (agent-trust-presets.ts,
// autonomous-goal-claude-trust.ts) once that worktree is deleted, so they do not pile up in the
// users' agent configs. Codex trust is per repository root, so it is left alone.
import { existsSync, readdirSync, rmdirSync, unlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseWslUncPath } from '../shared/wsl-paths'
import { LOCAL_EXECUTION_HOST_ID } from '../shared/execution-host'
import { splitWorktreeId } from '../shared/worktree/id'
import { listClaudeProfileConfigDirs } from './claude-accounts/profile/claude-profile-roots'
import {
  asJsonObject,
  readJsonObjectFile,
  updateJsonObjectFile
} from './claude-accounts/profile/claude-profile-json'
import { claudeConfigStatePath } from './claude-accounts/profile/claude-shell-selector-discovery'
import { ClaudeRuntimePathResolver } from './claude-accounts/runtime-paths'

type RevocationDeps = {
  home?: string
  platform?: NodeJS.Platform
  claudeProfileDirs?: () => readonly string[]
}

/** Spellings of the removed path an entry may hold; Dolphin stores worktree paths resolved. */
function pathMatcher(worktreePath: string, platform: NodeJS.Platform): (value: unknown) => boolean {
  const fold = (value: string): string =>
    platform === 'win32' || platform === 'darwin' ? value.toLowerCase() : value
  const targets = new Set([fold(worktreePath), fold(resolve(worktreePath))])
  return (value) => typeof value === 'string' && targets.has(fold(value))
}

function cursorSlug(worktreePath: string): string {
  return resolve(worktreePath)
    .replace(/^[\\/]+/, '')
    .replace(/[\\/:*?"<>|]+/g, '-')
}

function revokeCursor(worktreePath: string, home: string): void {
  const slug = cursorSlug(worktreePath)
  if (!slug) {
    return
  }
  const trustDir = join(home, '.cursor', 'projects', slug)
  const trustFile = join(trustDir, '.workspace-trusted')
  if (!existsSync(trustFile)) {
    return
  }
  unlinkSync(trustFile)
  // Why only when empty: Cursor keeps other per-project data beside the marker.
  if (readdirSync(trustDir).length === 0) {
    rmdirSync(trustDir)
  }
}

/** Removes the path from a JSON array setting; a missing or malformed file is left alone. */
async function revokeFromList(
  configPath: string,
  key: string,
  matches: (value: unknown) => boolean
): Promise<void> {
  const current = existsSync(configPath) ? readJsonObjectFile(configPath) : null
  const list = current?.[key]
  if (!Array.isArray(list) || !list.some(matches)) {
    return
  }
  await updateJsonObjectFile(configPath, (config) => {
    const entries = config[key]
    return Array.isArray(entries)
      ? { ...config, [key]: entries.filter((entry) => !matches(entry)) }
      : config
  })
}

async function revokeClaude(
  statePath: string,
  matches: (value: unknown) => boolean
): Promise<void> {
  const projects = asJsonObject(
    existsSync(statePath) ? readJsonObjectFile(statePath)?.projects : null
  )
  if (!Object.keys(projects).some(matches)) {
    return
  }
  // Why the whole entry: it only holds that folder's trust and settings; its conversations live
  // in the projects/ history, which is kept.
  await updateJsonObjectFile(statePath, (config) => {
    const next = { ...asJsonObject(config.projects) }
    for (const key of Object.keys(next)) {
      if (matches(key)) {
        delete next[key]
      }
    }
    return { ...config, projects: next }
  })
}

/**
 * Best-effort: every config is handled on its own, and one that fails (locked, malformed) never
 * stops the others or the worktree removal itself.
 */
export async function revokeWorktreeAgentTrust(
  worktreePath: string,
  deps: RevocationDeps = {}
): Promise<void> {
  // Why: a WSL worktree's agents read the distro's own configs, not this host's.
  if (!worktreePath || parseWslUncPath(worktreePath)) {
    return
  }
  const home = deps.home ?? homedir()
  const matches = pathMatcher(worktreePath, deps.platform ?? process.platform)
  const steps: (() => unknown)[] = [
    () => revokeCursor(worktreePath, home),
    () => revokeFromList(join(home, '.copilot', 'config.json'), 'trustedFolders', matches),
    () =>
      revokeFromList(
        join(home, '.gemini', 'antigravity-cli', 'settings.json'),
        'trustedWorkspaces',
        matches
      ),
    // Why the resolver: it is the same file autonomous-goal trust writes (honors CLAUDE_CONFIG_DIR).
    () =>
      revokeClaude(
        deps.home
          ? claudeConfigStatePath(join(home, '.claude'), home)
          : new ClaudeRuntimePathResolver().getRuntimePaths().configPath,
        matches
      ),
    ...(deps.claudeProfileDirs ?? listClaudeProfileConfigDirs)().map(
      (dir) => () => revokeClaude(join(dir, '.claude.json'), matches)
    )
  ]
  for (const step of steps) {
    try {
      await step()
    } catch (error) {
      console.warn('[worktrees] Could not drop agent trust for removed worktree', error)
    }
  }
}

/** For a removed worktree on this host: drops its trust entries in the background. */
export function revokeLocalWorktreeAgentTrust(worktreeId: string, hostId?: string): void {
  // Why local only: an SSH or server worktree's trust lives in that host's own configs.
  if (hostId && hostId !== LOCAL_EXECUTION_HOST_ID) {
    return
  }
  const worktreePath = splitWorktreeId(worktreeId)?.worktreePath
  if (worktreePath) {
    void revokeWorktreeAgentTrust(worktreePath)
  }
}
