import { mkdtemp, mkdir, rm, writeFile, link, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { listStorageFootprintRoots, measureStorageFootprint } from './storage-footprint'

describe('measureStorageFootprint', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'orca-footprint-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('sums files per root and reports absent roots', async () => {
    await mkdir(join(dir, 'terminal-history', 'sess-a'), { recursive: true })
    await writeFile(join(dir, 'terminal-history', 'sess-a', 'output.log'), 'x'.repeat(100))
    await writeFile(join(dir, 'terminal-history', 'meta.json'), 'y'.repeat(10))

    const footprint = await measureStorageFootprint(listStorageFootprintRoots(dir))
    const history = footprint.entries.find((e) => e.kind === 'terminal-history')

    expect(history).toMatchObject({
      exists: true,
      bytes: 110,
      fileCount: 2,
      topLevelEntryCount: 2,
      truncated: false
    })
    expect(footprint.entries.find((e) => e.kind === 'logs')?.exists).toBe(false)
    expect(footprint.totalBytes).toBe(110)
  })

  it('counts a hardlinked file once and does not follow symlinks', async () => {
    const a = join(dir, 'codex-runtime-home')
    const b = join(dir, 'codex-accounts')
    const outside = join(dir, 'outside')
    await mkdir(a)
    await mkdir(b)
    await mkdir(outside)
    await writeFile(join(a, 'rollout.jsonl'), 'z'.repeat(50))
    await link(join(a, 'rollout.jsonl'), join(b, 'rollout.jsonl'))
    await writeFile(join(outside, 'big'), 'w'.repeat(1000))
    await symlink(outside, join(b, 'sessions'))

    const footprint = await measureStorageFootprint([
      { kind: 'codex-runtime-home', path: a },
      { kind: 'codex-accounts', path: b }
    ])

    expect(footprint.totalBytes).toBe(50)
  })

  it('stops at the entry cap and marks the result partial', async () => {
    const root = join(dir, 'logs')
    await mkdir(root)
    for (let i = 0; i < 5; i++) {
      await writeFile(join(root, `f${i}`), 'a')
    }

    const footprint = await measureStorageFootprint([{ kind: 'logs', path: root }], 3)

    expect(footprint.entries[0].truncated).toBe(true)
    expect(footprint.entries[0].fileCount).toBeLessThan(5)
  })
})
