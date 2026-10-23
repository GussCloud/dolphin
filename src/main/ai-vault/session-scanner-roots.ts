import { homedir } from 'node:os'
import { join } from 'node:path'
import { DEEPSEEK_CLAUDE_CONFIG_DIR_NAME } from '../../shared/deepseek-claude-provider'
import { resolveOmpSessionsDir } from './omp-session-root'

// The default local roots for the two agents whose subagent transcripts are
// read back by renderer-supplied path (Claude and OMP). Discovery scans these;
// the IPC listers use the root enumerations below to reject arbitrary paths.
const CLAUDE_PROJECTS_DIR = join(homedir(), '.claude', 'projects')
const DEEPSEEK_PROJECTS_DIR = join(homedir(), DEEPSEEK_CLAUDE_CONFIG_DIR_NAME, 'projects')

// The local host and each WSL distro's `~/.claude/projects`. Callers reading
// Claude session files by path use these roots to reject arbitrary paths.
export function claudeProjectsRootDirs(args: {
  claudeProjectsDir?: string
  wslHomeDirs?: readonly string[]
}): string[] {
  return [
    args.claudeProjectsDir ?? CLAUDE_PROJECTS_DIR,
    ...(args.wslHomeDirs ?? []).map((homeDir) => join(homeDir, '.claude', 'projects'))
  ]
}

// The local host and each WSL distro's `~/.claude-deepseek/projects`. No SSH
// roots: DeepSeek launches are refused over SSH, so a remote home never has them.
export function deepSeekProjectsRootDirs(args: {
  deepSeekProjectsDir?: string
  wslHomeDirs?: readonly string[]
}): string[] {
  return [
    args.deepSeekProjectsDir ?? DEEPSEEK_PROJECTS_DIR,
    ...(args.wslHomeDirs ?? []).map((homeDir) =>
      join(homeDir, DEEPSEEK_CLAUDE_CONFIG_DIR_NAME, 'projects')
    )
  ]
}

/** Roots that hold Claude Code JSONL transcripts for `agent`, for by-path read guards. */
export function claudeTranscriptRootDirs(
  agent: 'claude' | 'deepseek',
  wslHomeDirs: readonly string[]
): string[] {
  return agent === 'deepseek'
    ? deepSeekProjectsRootDirs({ wslHomeDirs })
    : claudeProjectsRootDirs({ wslHomeDirs })
}

// The local host and each WSL distro's OMP sessions root. Callers reading OMP
// session files by path use these roots to reject arbitrary paths.
export function ompSessionsRootDirs(args: {
  ompSessionsDir?: string
  wslHomeDirs?: readonly string[]
}): string[] {
  return (
    sessionRootDirs(
      resolveOmpSessionsDir({ sessionsDir: args.ompSessionsDir }),
      normalizedWslHomeDirs(args.wslHomeDirs),
      ['.omp', 'agent', 'sessions']
    )
      // Why: OMP_CODING_AGENT_DIR='/' normalizes to '', which resolve()s to the
      // process cwd — an empty root would silently allowlist it.
      .filter((rootDir) => rootDir.trim().length > 0)
  )
}

export function normalizedWslHomeDirs(homeDirs: readonly string[] | undefined): string[] {
  const seen = new Set<string>()
  const unique: string[] = []
  for (const homeDir of homeDirs ?? []) {
    const trimmed = homeDir.trim()
    if (!trimmed || seen.has(trimmed)) {
      continue
    }
    seen.add(trimmed)
    unique.push(trimmed)
  }
  return unique
}

export function sessionRootDirs(
  hostRootDir: string,
  wslHomeDirs: readonly string[],
  segments: readonly string[]
): string[] {
  return [hostRootDir, ...wslHomeDirs.map((homeDir) => join(homeDir, ...segments))]
}
