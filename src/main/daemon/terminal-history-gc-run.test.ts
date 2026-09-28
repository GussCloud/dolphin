import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runTerminalHistoryGc } from './terminal-history-gc-run'

const DAY = 24 * 60 * 60 * 1000
const policy = { maxAgeMs: 30 * DAY, maxTotalBytes: 5 * 1024 ** 3 }

describe('runTerminalHistoryGc', () => {
  let dir: string

  async function seed(sessionId: string, ageDays: number): Promise<void> {
    const sessionDir = join(dir, encodeURIComponent(sessionId))
    await mkdir(sessionDir)
    await writeFile(join(sessionDir, 'output.log'), 'data')
    const at = new Date(Date.now() - ageDays * DAY)
    await utimes(join(sessionDir, 'output.log'), at, at)
  }

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'dolphin-gc-run-'))
    await seed('stale', 60)
    await seed('live', 60)
    await seed('saved', 60)
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  function deps(complete: boolean) {
    return {
      basePath: dir,
      listDaemonSessions: async () => ({
        sessions: [{ sessionId: 'live', isAlive: true }],
        complete
      }),
      readPersistedWorkspaceSessions: () => [{ tabs: [{ ptyId: 'saved' }] }],
      removeSessionTree: vi.fn(async () => {})
    }
  }

  it('removes only unowned stale history', async () => {
    const d = deps(true)

    const result = await runTerminalHistoryGc(d, { policy, dryRun: false })

    expect(d.removeSessionTree.mock.calls).toEqual([['stale']])
    expect(result.removed.map((c) => c.sessionId)).toEqual(['stale'])
    expect(result.keptByReason).toEqual({ 'live-in-daemon': 1, 'referenced-by-saved-tab': 1 })
  })

  it('plans without removing on a dry run', async () => {
    const d = deps(true)

    const result = await runTerminalHistoryGc(d, { policy, dryRun: true })

    expect(d.removeSessionTree).not.toHaveBeenCalled()
    expect(result.removed.map((c) => c.sessionId)).toEqual(['stale'])
  })

  it('refuses to remove anything when a daemon did not answer', async () => {
    const d = deps(false)

    const result = await runTerminalHistoryGc(d, { policy, dryRun: false })

    expect(d.removeSessionTree).not.toHaveBeenCalled()
    expect(result.refusedReason).toBe('daemon-inventory-incomplete')
  })

  it('refuses when no daemon is running to vouch for its sessions', async () => {
    const d = { ...deps(true), listDaemonSessions: async () => null }

    const result = await runTerminalHistoryGc(d, { policy, dryRun: false })

    expect(d.removeSessionTree).not.toHaveBeenCalled()
    expect(result.refusedReason).toBe('daemon-inventory-incomplete')
  })
})
