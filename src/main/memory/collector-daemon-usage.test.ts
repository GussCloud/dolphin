import { describe, expect, it } from 'vitest'
import { collectDaemonUsage } from './collector'

function makeIndex(
  rows: { pid: number; ppid: number; memory?: number; privateMemory?: number; name?: string }[]
) {
  const byPid = new Map<
    number,
    {
      pid: number
      ppid: number
      cpu: number
      memory: number
      privateMemory?: number
      name?: string
    }
  >()
  const childrenOf = new Map<number, number[]>()
  for (const r of rows) {
    byPid.set(r.pid, { cpu: 0, memory: 0, ...r })
    childrenOf.set(r.ppid, [...(childrenOf.get(r.ppid) ?? []), r.pid])
  }
  return {
    byPid,
    childrenOf,
    hasPrivateMemory: rows.some((r) => r.privateMemory !== undefined)
  }
}

describe('collectDaemonUsage', () => {
  it('reports the daemon row and counts descendants no session claimed', () => {
    const index = makeIndex([
      { pid: 10, ppid: 1, memory: 4096 },
      { pid: 11, ppid: 10 }, // claimed shell
      { pid: 12, ppid: 11 }, // claimed agent
      { pid: 13, ppid: 10 }, // untracked shell
      { pid: 14, ppid: 13 } // its child
    ])

    expect(collectDaemonUsage(index, 10, new Set([11, 12]))).toEqual({
      pid: 10,
      cpu: 0,
      memory: 4096,
      untrackedDescendantCount: 2
    })
  })

  it('carries committed bytes only when the sweep reported them', () => {
    const index = makeIndex([{ pid: 10, ppid: 1, memory: 1, privateMemory: 2048 }])

    expect(collectDaemonUsage(index, 10, new Set())?.privateMemory).toBe(2048)
  })

  it('is absent when there is no daemon or the sweep missed it', () => {
    const index = makeIndex([{ pid: 10, ppid: 1 }])

    expect(collectDaemonUsage(index, null, new Set())).toBeUndefined()
    expect(collectDaemonUsage(index, 99, new Set())).toBeUndefined()
  })

  // Why this shape: a live Windows ConPTY terminal, captured from a real Dolphin install.
  it('does not count the OpenConsole host paired with a tracked Windows shell', () => {
    const index = makeIndex([
      { pid: 22048, ppid: 1, name: 'Dolphin.exe' },
      { pid: 19248, ppid: 22048, name: 'OpenConsole.exe' },
      { pid: 20588, ppid: 22048, name: 'powershell.exe' }
    ])

    expect(collectDaemonUsage(index, 22048, new Set([20588]))?.untrackedDescendantCount).toBe(0)
  })

  it('still counts a console host whose shell is gone', () => {
    const index = makeIndex([
      { pid: 10, ppid: 1 },
      { pid: 11, ppid: 10, name: 'OpenConsole.exe' },
      { pid: 12, ppid: 10, name: 'powershell.exe' },
      { pid: 13, ppid: 10, name: 'OpenConsole.exe' }
    ])

    expect(collectDaemonUsage(index, 10, new Set([12]))?.untrackedDescendantCount).toBe(1)
  })

  it('stays conservative when the sweep carries no names', () => {
    const index = makeIndex([
      { pid: 10, ppid: 1 },
      { pid: 11, ppid: 10 },
      { pid: 12, ppid: 10 }
    ])

    expect(collectDaemonUsage(index, 10, new Set([12]))?.untrackedDescendantCount).toBe(1)
  })
})
