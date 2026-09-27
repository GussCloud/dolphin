import { describe, expect, it } from 'vitest'
import { collectDaemonUsage } from './collector'

function makeIndex(rows: { pid: number; ppid: number; memory?: number; privateMemory?: number }[]) {
  const byPid = new Map<
    number,
    { pid: number; ppid: number; cpu: number; memory: number; privateMemory?: number }
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
})
