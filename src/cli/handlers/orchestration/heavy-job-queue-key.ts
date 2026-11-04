import { readFileSync, realpathSync, statSync } from 'node:fs'
import { hostname } from 'node:os'
import path from 'node:path'

/**
 * One queue per execution host and repository: every worktree of a repo shares its git common
 * dir, and a folder workspace (no git) is keyed by its own path. Read from disk, not `git`, so it
 * costs no process and no Git-version capability.
 */
export function resolveHeavyJobQueueKey(cwd: string, platform = process.platform): string {
  const repository = findGitCommonDir(cwd) ?? canonicalPath(cwd)
  const normalized = platform === 'win32' ? repository.toLowerCase() : repository
  return `${hostname()}|${normalized}`
}

function findGitCommonDir(start: string): string | null {
  let dir = path.resolve(start)
  for (;;) {
    const dotGit = path.join(dir, '.git')
    const kind = statKind(dotGit)
    if (kind === 'dir') {
      return canonicalPath(dotGit)
    }
    if (kind === 'file') {
      return commonDirOfLinkedWorktree(dotGit, dir)
    }
    const parent = path.dirname(dir)
    if (parent === dir) {
      return null
    }
    dir = parent
  }
}

// Why: a linked worktree's `.git` file names its private gitdir, whose `commondir` names the shared one.
function commonDirOfLinkedWorktree(dotGitFile: string, worktreeDir: string): string | null {
  const match = /^gitdir:\s*(.+)$/m.exec(readText(dotGitFile) ?? '')
  if (!match) {
    return null
  }
  const gitDir = path.resolve(worktreeDir, match[1].trim())
  const common = readText(path.join(gitDir, 'commondir'))?.trim()
  return canonicalPath(common ? path.resolve(gitDir, common) : gitDir)
}

function statKind(target: string): 'dir' | 'file' | null {
  try {
    const stats = statSync(target)
    return stats.isDirectory() ? 'dir' : stats.isFile() ? 'file' : null
  } catch {
    return null
  }
}

function readText(target: string): string | null {
  try {
    return readFileSync(target, 'utf8')
  } catch {
    return null
  }
}

function canonicalPath(target: string): string {
  try {
    return realpathSync(target)
  } catch {
    return path.resolve(target)
  }
}
