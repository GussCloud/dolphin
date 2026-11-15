import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Repo } from '../../shared/repo-types'
import type { Store } from '../persistence'
import { deletePreservedBranch, listPreservedBranches } from './preserved-branch-listing'
import { readPreservedBranchRecords, recordPreservedBranch } from './preserved-branch-registry'

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf-8' }).trim()
}

describe('preserved branch registry', () => {
  let root: string
  let repoPath: string
  let dir: string
  let store: Store

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'preserved-branches-'))
    repoPath = path.join(root, 'repo')
    dir = path.join(root, 'userData')
    execFileSync('mkdir', ['-p', repoPath, dir])
    git(repoPath, 'init', '-q', '-b', 'main')
    git(
      repoPath,
      '-c',
      'user.name=t',
      '-c',
      'user.email=t@t',
      'commit',
      '-q',
      '--allow-empty',
      '-m',
      'a'
    )
    git(repoPath, 'branch', 'kept')
    git(repoPath, 'branch', 'moved')
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: listing reads only getRepos.
    store = {
      getRepos: () => [{ id: 'repo-1', path: repoPath, displayName: 'Repo', kind: 'git' } as Repo]
    } as unknown as Store
  })

  afterEach(() => rmSync(root, { recursive: true, force: true }))

  const run = (argv: string[], cwd: string) =>
    Promise.resolve({ stdout: git(cwd, ...argv), stderr: '' })
  const deps = () => ({ dir, runGit: () => run })

  it('lists only branches still at the kept commit and deletes them safely', async () => {
    const head = git(repoPath, 'rev-parse', 'kept')
    for (const branchName of ['kept', 'moved', 'gone']) {
      recordPreservedBranch(
        { worktreeId: `repo-1::/wt/${branchName}`, branchName, head },
        { dir, now: 1 }
      )
    }
    recordPreservedBranch(
      { worktreeId: 'repo-1::/wt/remote', hostId: 'ssh:box', branchName: 'remote', head },
      { dir }
    )
    git(
      repoPath,
      '-c',
      'user.name=t',
      '-c',
      'user.email=t@t',
      'commit',
      '-q',
      '--allow-empty',
      '-m',
      'b'
    )
    git(repoPath, 'branch', '-f', 'moved', 'HEAD')

    const listed = await listPreservedBranches(store, deps())
    expect(listed.map((entry) => entry.branchName)).toEqual(['kept'])
    expect(listed[0]).toMatchObject({ repoName: 'Repo', worktreePath: '/wt/kept' })
    // Stale records are dropped from the file too.
    expect(readPreservedBranchRecords(dir).map((entry) => entry.branchName)).toEqual(['kept'])

    await deletePreservedBranch(store, { repoId: 'repo-1', branchName: 'kept' }, deps())
    expect(git(repoPath, 'branch', '--list', 'kept')).toBe('')
    expect(readPreservedBranchRecords(dir)).toEqual([])
    await expect(
      deletePreservedBranch(store, { repoId: 'repo-1', branchName: 'kept' }, deps())
    ).rejects.toThrow('no longer listed')
  })
})
