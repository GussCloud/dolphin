import { beforeAll, describe, expect, it } from 'vitest'

type Agent = { id: string; cli: string; state: string; branch: string | null; name?: string; parentId?: string }
type AgentNode = { agent: Agent; children: AgentNode[] }
type Dev = { id: string; name: string; machines: string[]; status: 'online' | 'offline'; projects: { id: string; name: string; agents: Agent[] }[] }
type Storage = { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }
type OfficeModel = {
  tally(agents: Agent[]): { working: number; permission: number; idle: number; total: number }
  groupState(agents: Agent[]): string
  createAgentNamer(): { nameFor(devId: string, agent: Agent): string; retain(live: Set<string>): void }
  nestAgents(agents: Agent[]): AgentNode[]
  rotationQueue(devs: Dev[]): string[]
  readRotation(storage: Storage | null): boolean
  writeRotation(storage: Storage | null, on: boolean): void
  fitScale(natural: number, available: number): number
  initials(name: string): string
  projectColor(index: number): number
}

let M: OfficeModel

beforeAll(async () => {
  // A plain browser script: it registers itself on globalThis.
  const script = '../static/office/office-model.js'
  await import(script)
  const model: unknown = Reflect.get(globalThis, 'DolphinOfficeModel')
  if (!model || typeof model !== 'object' || typeof Reflect.get(model, 'rotationQueue') !== 'function') {
    throw new Error('office-model.js did not register DolphinOfficeModel')
  }
  M = Reflect.get(globalThis, 'DolphinOfficeModel')
})

const agent = (id: string, state: string, extra: Partial<Agent> = {}): Agent => ({ id, cli: 'claude', state, branch: 'main', ...extra })
const dev = (id: string, agents: Agent[], status: Dev['status'] = 'online'): Dev => ({
  id, name: id, machines: ['pc'], status, projects: agents.length ? [{ id: `${id}:p`, name: 'repo', agents }] : []
})

function memoryStorage(): Storage & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) }
}

describe('office model', () => {
  it('counts states, treating an unknown one as idle', () => {
    expect(M.tally([agent('a', 'working'), agent('b', 'permission'), agent('c', 'idle'), agent('d', 'surprise')]))
      .toEqual({ working: 1, permission: 1, idle: 2, total: 4 })
  })

  it('colors a project by its most urgent agent: approval, then work, then idle', () => {
    expect(M.groupState([agent('a', 'working'), agent('b', 'permission')])).toBe('permission')
    expect(M.groupState([agent('a', 'idle'), agent('b', 'working')])).toBe('working')
    expect(M.groupState([agent('a', 'idle')])).toBe('idle')
    expect(M.groupState([])).toBe('idle')
  })

  it('names agents from the stream, numbers unnamed ones and keeps names stable', () => {
    const namer = M.createAgentNamer()
    expect(namer.nameFor('u1', agent('a1', 'working'))).toBe('Claude 1')
    expect(namer.nameFor('u1', agent('a2', 'working'))).toBe('Claude 2')
    expect(namer.nameFor('u1', agent('a3', 'working', { name: 'impl' }))).toBe('impl')
    expect(namer.nameFor('u1', agent('a4', 'working', { name: 'impl' }))).toBe('impl 2')
    expect(namer.nameFor('u2', agent('b1', 'working', { cli: 'codex' }))).toBe('Codex 1')
    expect(namer.nameFor('u1', agent('a1', 'idle'))).toBe('Claude 1')
    namer.retain(new Set(['a2']))
    expect(namer.nameFor('u1', agent('a5', 'working'))).toBe('Claude 1')
  })

  it('nests agents under their lead and keeps every agent visible when a link is broken or cyclic', () => {
    const shape = (nodes: AgentNode[]): unknown => nodes.map((n) => (n.children.length ? { [n.agent.id]: shape(n.children) } : n.agent.id))
    const lead = agent('lead', 'working')
    expect(shape(M.nestAgents([
      lead,
      agent('impl', 'working', { parentId: 'lead' }),
      agent('review', 'idle', { parentId: 'lead' }),
      agent('helper', 'working', { parentId: 'impl' }),
      agent('solo', 'idle')
    ]))).toEqual([{ lead: [{ impl: ['helper'] }, 'review'] }, 'solo'])
    expect(shape(M.nestAgents([agent('orphan', 'working', { parentId: 'gone' }), agent('self', 'idle', { parentId: 'self' })])))
      .toEqual(['orphan', 'self'])
    const cycle = M.nestAgents([agent('a', 'working', { parentId: 'b' }), agent('b', 'working', { parentId: 'a' })])
    const seen: string[] = []
    const walk = (nodes: AgentNode[]): void => nodes.forEach((n) => { seen.push(n.agent.id); walk(n.children) })
    walk(cycle)
    expect(seen.sort()).toEqual(['a', 'b'])
  })

  it('rotates through devs with an approval waiting first and skips offline devs with nothing left', () => {
    const devs = [
      dev('calm', [agent('a', 'working')]),
      dev('gone', [], 'offline'),
      dev('waiting', [agent('b', 'permission')]),
      dev('stale', [agent('c', 'permission')], 'offline'),
      dev('empty', [])
    ]
    expect(M.rotationQueue(devs)).toEqual(['waiting', 'calm', 'stale', 'empty'])
  })

  it('keeps the rotation off until this browser turns it on', () => {
    const storage = memoryStorage()
    expect(M.readRotation(storage)).toBe(false)
    expect(M.readRotation(null)).toBe(false)
    M.writeRotation(storage, true)
    expect(M.readRotation(storage)).toBe(true)
    M.writeRotation(storage, false)
    expect(storage.data.size).toBe(0)
    const broken: Storage = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }, removeItem: () => {} }
    expect(M.readRotation(broken)).toBe(false)
    expect(() => M.writeRotation(broken, true)).not.toThrow()
  })

  it('shrinks the tree to fit but never below 70%, and never enlarges it', () => {
    expect(M.fitScale(1000, 1200)).toBe(1)
    expect(M.fitScale(1000, 900)).toBe(0.9)
    expect(M.fitScale(2000, 900)).toBe(0.7)
    expect(M.fitScale(0, 900)).toBe(1)
  })

  it('makes initials from the first and last name and cycles project colors', () => {
    expect(M.initials('Ana Maria Ribeiro')).toBe('AR')
    expect(M.initials('bruno')).toBe('B')
    expect(M.initials('  ')).toBe('?')
    expect([0, 1, 5, 6].map((i) => M.projectColor(i))).toEqual([1, 2, 6, 1])
  })
})
