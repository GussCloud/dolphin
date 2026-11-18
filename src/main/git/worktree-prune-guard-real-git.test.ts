// Real Git proves the prune guard's lock actually keeps the other Git's entry through a prune.
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { pruneGitWorktrees } from './worktree-prune-guard'

const execFileAsync = promisify(execFile)

let scratchDir = ''
let repoPath = ''

async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd })
  return stdout
}

async function addAdminEntry(name: string, gitdir: string): Promise<string> {
  const entry = join(repoPath, '.git', 'worktrees', name)
  await mkdir(entry, { recursive: true })
  await writeFile(join(entry, 'gitdir'), `${gitdir}\n`)
  await writeFile(join(entry, 'HEAD'), `${(await git(['rev-parse', 'HEAD'], repoPath)).trim()}\n`)
  await writeFile(join(entry, 'commondir'), '../..\n')
  return entry
}

beforeEach(async () => {
  scratchDir = await realpath(await mkdtemp(join(tmpdir(), 'dolphin-prune-guard-real-')))
  repoPath = join(scratchDir, 'repo')
  await mkdir(repoPath)
  await git(['init', '-q'], repoPath)
  await git(['config', 'user.email', 'prune@example.invalid'], repoPath)
  await git(['config', 'user.name', 'Prune Guard'], repoPath)
  await git(['commit', '-q', '--allow-empty', '-m', 'seed'], repoPath)
})

afterEach(async () => {
  await rm(scratchDir, { recursive: true, force: true })
})

describe.skipIf(process.platform === 'win32')(
  'pruneGitWorktrees against the real Git binary',
  () => {
    it("keeps the other Git's unreadable entry while pruning a genuinely stale one", async () => {
      // Host Git (not WSL) reads POSIX links as the other Git's; a drive-letter link is its own.
      const wslEntry = await addAdminEntry('wsl', '/mnt/c/src/app-wsl/.git')
      const staleEntry = await addAdminEntry('stale', 'C:/src/gone/.git')

      await pruneGitWorktrees({ cwd: repoPath }, 'win32')

      expect(existsSync(join(wslEntry, 'gitdir'))).toBe(true)
      expect(existsSync(join(wslEntry, 'locked'))).toBe(false)
      expect(existsSync(staleEntry)).toBe(false)
    })

    it('prunes a stale POSIX entry off Windows, as plain git worktree prune does', async () => {
      const posixEntry = await addAdminEntry('posix', join(scratchDir, 'gone', '.git'))

      await pruneGitWorktrees({ cwd: repoPath }, 'linux')

      expect(existsSync(posixEntry)).toBe(false)
    })
  }
)
