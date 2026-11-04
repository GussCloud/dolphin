import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resolveHeavyJobQueueKey } from './heavy-job-queue-key'

describe('heavy job queue key', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'heavy-job-key-'))
  })
  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('gives every worktree of a repository the same queue', () => {
    const main = path.join(root, 'main')
    const worktreeGitDir = path.join(main, '.git', 'worktrees', 'feature')
    mkdirSync(worktreeGitDir, { recursive: true })
    writeFileSync(path.join(worktreeGitDir, 'commondir'), '../..\n')
    const linked = path.join(root, 'feature')
    mkdirSync(path.join(linked, 'src'), { recursive: true })
    writeFileSync(path.join(linked, '.git'), `gitdir: ${worktreeGitDir}\n`)

    const mainKey = resolveHeavyJobQueueKey(main)
    expect(resolveHeavyJobQueueKey(path.join(linked, 'src'))).toBe(mainKey)
    expect(mainKey.endsWith('.git')).toBe(true)
  })

  it('keys a folder workspace without git by its own path', () => {
    const folderA = path.join(root, 'a')
    const folderB = path.join(root, 'b')
    mkdirSync(folderA)
    mkdirSync(folderB)
    expect(resolveHeavyJobQueueKey(folderA)).not.toBe(resolveHeavyJobQueueKey(folderB))
  })
})
