import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_STORAGE_GC_POLICY,
  collectReferencedSessionIds,
  planTerminalHistoryGc,
  scanTerminalHistorySessionTrees,
  type TerminalHistorySessionTree
} from './terminal-history-session-retention'

const DAY = 24 * 60 * 60 * 1000
const NOW = 1_000 * DAY

function tree(sessionId: string, ageDays: number, bytes = 100): TerminalHistorySessionTree {
  return { sessionId, bytes, lastActivityAt: NOW - ageDays * DAY, recoveryProtected: false }
}

function plan(
  trees: TerminalHistorySessionTree[],
  extra: Partial<Parameters<typeof planTerminalHistoryGc>[0]> = {}
) {
  return planTerminalHistoryGc({
    trees,
    policy: DEFAULT_STORAGE_GC_POLICY,
    now: NOW,
    liveSessionIds: new Set(),
    referencedSessionIds: new Set(),
    ...extra
  })
}

describe('planTerminalHistoryGc', () => {
  it('removes only trees past the age limit', () => {
    const result = plan([tree('old', 40), tree('fresh', 5)])

    expect(result.remove.map((c) => c.sessionId)).toEqual(['old'])
    expect(result.keptByReason).toEqual({ 'within-policy': 1 })
  })

  it('never removes a live, referenced, protected, or recently active tree', () => {
    const result = plan(
      [
        tree('live', 90),
        tree('saved-tab', 90),
        { ...tree('quarantined', 90), recoveryProtected: true },
        tree('racing-spawn', 0.5)
      ],
      {
        liveSessionIds: new Set(['live']),
        referencedSessionIds: new Set(['saved-tab']),
        policy: { maxAgeMs: 0, maxTotalBytes: 0 }
      }
    )

    expect(result.remove).toEqual([])
    expect(result.keptByReason).toEqual({
      'live-in-daemon': 1,
      'referenced-by-saved-tab': 1,
      'recovery-protected': 1,
      'recently-active': 1
    })
  })

  it('evicts oldest first until the total fits the size limit', () => {
    const result = plan([tree('newest', 3, 400), tree('oldest', 9, 400), tree('middle', 6, 400)], {
      policy: { maxAgeMs: 365 * DAY, maxTotalBytes: 500 }
    })

    expect(result.remove.map((c) => c.sessionId)).toEqual(['oldest', 'middle'])
    expect(result.totalBytes).toBe(1200)
  })
})

describe('collectReferencedSessionIds', () => {
  it('finds known ids anywhere in persisted state, as values or keys', () => {
    const known = new Set(['a', 'b', 'c'])
    const persisted = [
      { tabsByWorktree: { w: [{ ptyId: 'a' }] } },
      { ptyIdsByLeafId: { leaf: 'b' } },
      { restoredPtyIdByLeafId: {}, byPty: { c: true } },
      null
    ]

    expect([...collectReferencedSessionIds(persisted, known)].sort()).toEqual(['a', 'b', 'c'])
  })
})

describe('scanTerminalHistorySessionTrees', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'dolphin-history-gc-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('lists session trees and skips shell history dirs and dot entries', async () => {
    const sessionId = 'repo::/w@@abc'
    const sessionDir = join(dir, encodeURIComponent(sessionId))
    await mkdir(sessionDir)
    await writeFile(join(sessionDir, 'output.log'), 'x'.repeat(30))
    await writeFile(
      join(sessionDir, 'meta.json'),
      JSON.stringify({ cwd: '/', cols: 80, rows: 24, startedAt: '', endedAt: null, exitCode: null })
    )
    const old = new Date(NOW - 50 * DAY)
    await utimes(join(sessionDir, 'output.log'), old, old)
    await utimes(join(sessionDir, 'meta.json'), old, old)
    await mkdir(join(dir, '0123456789abcdef'))
    await writeFile(join(dir, '0123456789abcdef', 'zsh_history'), 'ls')
    await mkdir(join(dir, '.pending-delete'))

    const trees = await scanTerminalHistorySessionTrees(dir)

    expect(trees).toHaveLength(1)
    expect(trees[0]).toMatchObject({ sessionId, recoveryProtected: false })
    expect(trees[0].bytes).toBeGreaterThan(30)
    expect(trees[0].lastActivityAt).toBe(old.getTime())
  })

  it('treats a missing root as empty', async () => {
    expect(await scanTerminalHistorySessionTrees(join(dir, 'absent'))).toEqual([])
  })
})
