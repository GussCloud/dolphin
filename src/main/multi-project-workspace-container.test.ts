import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { removeEmptyMultiProjectContainer } from './multi-project-workspace-container'
import { WORKTREE_TRASH_DIR_NAME } from './worktree-trash'

let root: string

describe('removeEmptyMultiProjectContainer', () => {
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'multi-project-container-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('removes the container and its drained trash root', async () => {
    const container = join(root, 'feature-x')
    mkdirSync(join(container, WORKTREE_TRASH_DIR_NAME), { recursive: true })

    await removeEmptyMultiProjectContainer(container)

    expect(existsSync(container)).toBe(false)
  })

  it('keeps a container that still holds someone else’s files', async () => {
    const container = join(root, 'feature-x')
    mkdirSync(container)
    writeFileSync(join(container, 'notes.md'), 'keep me\n')

    await removeEmptyMultiProjectContainer(container)

    expect(existsSync(join(container, 'notes.md'))).toBe(true)
  })
})
