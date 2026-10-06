import { describe, expect, it } from 'vitest'
import { WorkPresenceRegistry, WorkPresenceSnapshot } from './work-presence-registry.js'

function snapshot(machineId: string, projects: WorkPresenceSnapshot['projects'] = []): WorkPresenceSnapshot {
  return { schemaVersion: 1, machineId, machineLabel: `${machineId}-host`, projects }
}

const dolphin = (agentId = 'a1') => ({
  id: 'p1',
  name: 'dolphin',
  agents: [{ id: agentId, cli: 'claude', state: 'working' as const, branch: 'feat/pix' }]
})

function clock() {
  let at = 1_000_000
  return { now: () => at, advance: (ms: number) => (at += ms) }
}

const MEMBERS = [
  { userId: 'usr_b', name: 'Bruno' },
  { userId: 'usr_a', name: 'Ana' }
]

describe('WorkPresenceRegistry', () => {
  it('merges every machine of an account into one dev, with machine-scoped ids, sorted by name', () => {
    const registry = new WorkPresenceRegistry()
    registry.put('usr_b', snapshot('m1', [dolphin()]))
    registry.put('usr_b', snapshot('m2', [dolphin()]))
    registry.put('usr_a', snapshot('m3'))
    registry.put('usr_outsider', snapshot('m4', [dolphin()]))
    const { devs } = registry.view(MEMBERS)
    expect(devs.map((d) => d.name)).toEqual(['Ana', 'Bruno'])
    const bruno = devs[1]
    expect(bruno?.machines).toEqual(['m1-host', 'm2-host'])
    expect(bruno?.projects.map((p) => p.id)).toEqual(['m1:p1', 'm2:p1'])
    expect(bruno?.projects[0]?.agents[0]).toEqual({ id: 'm1:a1', cli: 'claude', state: 'working', branch: 'feat/pix' })
  })

  it('replaces a machine snapshot whole, so closed agents disappear', () => {
    const registry = new WorkPresenceRegistry()
    registry.put('usr_a', snapshot('m1', [dolphin('a1')]))
    registry.put('usr_a', snapshot('m1', []))
    expect(registry.view(MEMBERS).devs[0]?.projects).toEqual([])
  })

  it('goes offline after 60 s of silence, drops 120 s later, and revives on the next snapshot', () => {
    const time = clock()
    const lines: string[] = []
    const registry = new WorkPresenceRegistry({ now: time.now, log: (line) => lines.push(line) })
    let changes = 0
    registry.subscribe(() => changes++)
    registry.put('usr_a', snapshot('m1', [dolphin()]))
    time.advance(60_000)
    registry.sweep()
    expect(registry.view(MEMBERS).devs[0]?.status).toBe('online')
    time.advance(1)
    registry.sweep()
    expect(registry.view(MEMBERS).devs[0]?.status).toBe('offline')
    expect(changes).toBe(2)
    registry.sweep()
    expect(changes).toBe(2)
    registry.put('usr_a', snapshot('m1', [dolphin()]))
    expect(registry.view(MEMBERS).devs[0]?.status).toBe('online')
    time.advance(180_001)
    registry.sweep()
    expect(registry.view(MEMBERS).devs).toEqual([])
    expect(lines.map((line) => line.split(' ')[0])).toEqual(['online', 'offline', 'back', 'dropped'])
  })

  it('keeps a dev online while any of their machines is', () => {
    const time = clock()
    const registry = new WorkPresenceRegistry({ now: time.now })
    registry.put('usr_a', snapshot('m1'))
    time.advance(40_000)
    registry.put('usr_a', snapshot('m2'))
    time.advance(10_000)
    registry.sweep()
    expect(registry.view(MEMBERS).devs[0]?.status).toBe('online')
  })

  it('removes a machine at once on graceful quit', () => {
    const registry = new WorkPresenceRegistry()
    let changes = 0
    registry.subscribe(() => changes++)
    registry.put('usr_a', snapshot('m1'))
    registry.remove('usr_a', 'm1')
    registry.remove('usr_a', 'm1')
    expect(registry.view(MEMBERS).devs).toEqual([])
    expect(changes).toBe(2)
  })

  it('validates the contract limits', () => {
    const agents = Array.from({ length: 60 }, (_, i) => ({ id: `a${i}`, cli: 'codex', state: 'idle', branch: null }))
    const tooMany = { ...snapshot('m1'), projects: [{ id: 'p1', name: 'x', agents }, { id: 'p2', name: 'y', agents }] }
    expect(WorkPresenceSnapshot.safeParse(tooMany).success).toBe(false)
    const badState = { ...snapshot('m1'), projects: [{ ...dolphin(), agents: [{ id: 'a', cli: 'x', state: 'done', branch: null }] }] }
    expect(WorkPresenceSnapshot.safeParse(badState).success).toBe(false)
    expect(WorkPresenceSnapshot.safeParse({ ...snapshot('m1'), machineId: '../etc' }).success).toBe(false)
    expect(WorkPresenceSnapshot.safeParse(snapshot('m1', [dolphin()])).success).toBe(true)
  })
})
