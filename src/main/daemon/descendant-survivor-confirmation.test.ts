import { describe, expect, it, vi } from 'vitest'
import { confirmShutdownDescendantSurvivors } from './descendant-survivor-confirmation'
import type { DescendantSnapshot } from '../pty-descendant-termination'

const snapshot: DescendantSnapshot = {
  rootPgid: 10,
  capturedAtMs: 0,
  descendants: [
    { pid: 11, ppid: 10, pgid: 10, startedAt: 'a' },
    { pid: 12, ppid: 11, pgid: 10, startedAt: 'b' }
  ]
}

describe('confirmShutdownDescendantSurvivors', () => {
  it('does nothing when the shutdown verdict was not live', async () => {
    const report = vi.fn()
    const confirm = vi.fn()

    for (const verdict of ['exited', 'unverifiable'] as const) {
      await expect(
        confirmShutdownDescendantSurvivors('s', snapshot, verdict, report, { delayMs: 0, confirm })
      ).resolves.toBeNull()
    }
    expect(report).not.toHaveBeenCalled()
    expect(confirm).not.toHaveBeenCalled()
  })

  it('reports a suspect, re-verifies, and reports the reap', async () => {
    const report = vi.fn()
    const confirm = vi.fn(async () => 'exited' as const)

    await expect(
      confirmShutdownDescendantSurvivors('s', snapshot, 'live', report, { delayMs: 0, confirm })
    ).resolves.toBe('exited')
    expect(confirm).toHaveBeenCalledWith(snapshot)
    expect(report.mock.calls).toEqual([
      ['process-orphan-suspected', { sessionId: 's', pids: [11, 12] }],
      ['process-orphan-reaped', { sessionId: 's', pids: [11, 12] }]
    ])
  })

  it('reports survivors that outlive the second pass as confirmed', async () => {
    const report = vi.fn()

    await confirmShutdownDescendantSurvivors('s', snapshot, 'live', report, {
      delayMs: 0,
      confirm: async () => 'live'
    })

    expect(report).toHaveBeenLastCalledWith('process-orphan-confirmed', {
      sessionId: 's',
      pids: [11, 12]
    })
  })

  it('never reads a failed second pass as proof of exit', async () => {
    const report = vi.fn()

    await expect(
      confirmShutdownDescendantSurvivors('s', snapshot, 'live', report, {
        delayMs: 0,
        confirm: async () => {
          throw new Error('ps failed')
        }
      })
    ).resolves.toBe('unverifiable')
    expect(report).toHaveBeenLastCalledWith('process-orphan-unverifiable', {
      sessionId: 's',
      pids: [11, 12]
    })
  })
})
