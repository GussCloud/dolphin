import { z } from 'zod'

export const WORK_PRESENCE_HEARTBEAT_MS = 20_000
// Why 60s: three missed 20s heartbeats, so one slow or lost request never greys a room.
const OFFLINE_AFTER_MS = 60_000
const DROP_AFTER_OFFLINE_MS = 120_000

const OpaqueId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)

const WORK_VIEW_AGENT_STATES = ['working', 'permission', 'idle'] as const
type WorkViewAgentState = (typeof WORK_VIEW_AGENT_STATES)[number]

function isWorkViewAgentState(value: string): value is WorkViewAgentState {
  return WORK_VIEW_AGENT_STATES.some((state) => state === value)
}

// Why degrade: a newer desktop's new state must not reject the whole snapshot and grey the room.
const WorkViewAgentStateSchema = z
  .string()
  .max(40)
  .transform((state): WorkViewAgentState => (isWorkViewAgentState(state) ? state : 'idle'))

export const WorkPresenceSnapshot = z.object({
  // Why any version >= 1: later versions only add fields, which are stripped here.
  schemaVersion: z.number().int().min(1),
  machineId: OpaqueId,
  machineLabel: z.string().trim().max(64),
  projects: z
    .array(
      z.object({
        id: OpaqueId,
        name: z.string().trim().min(1).max(80),
        agents: z
          .array(
            z.object({
              id: OpaqueId,
              cli: z.string().trim().min(1).max(40),
              state: WorkViewAgentStateSchema,
              branch: z.string().max(120).nullable()
            })
          )
          .max(100)
      })
    )
    .max(50)
    // Why: the agent cap is per machine, not per project.
    .refine((projects) => projects.reduce((n, p) => n + p.agents.length, 0) <= 100, 'too many agents')
})

export type WorkPresenceSnapshot = z.output<typeof WorkPresenceSnapshot>

export type WorkViewAgent = WorkPresenceSnapshot['projects'][number]['agents'][number]
export type WorkViewProject = { id: string; name: string; agents: WorkViewAgent[] }
export type WorkViewDev = {
  id: string
  name: string
  machines: string[]
  status: 'online' | 'offline'
  projects: WorkViewProject[]
}
export type WorkView = { devs: WorkViewDev[] }
export type WorkViewMember = { userId: string; name: string }

type MachinePresence = { snapshot: WorkPresenceSnapshot; lastSeenAt: number; offline: boolean }

/**
 * Live agent presence per account, held in memory: the auth service runs as one instance and
 * presence is rebuilt by the next heartbeat after a restart.
 */
export class WorkPresenceRegistry {
  private readonly users = new Map<string, Map<string, MachinePresence>>()
  private readonly listeners = new Set<() => void>()
  private readonly now: () => number
  private readonly log: (line: string) => void

  constructor(options: { now?: () => number; log?: (line: string) => void } = {}) {
    this.now = options.now ?? Date.now
    this.log = options.log ?? (() => {})
  }

  put(userId: string, snapshot: WorkPresenceSnapshot): void {
    let machines = this.users.get(userId)
    if (!machines) {
      machines = new Map()
      this.users.set(userId, machines)
    }
    const previous = machines.get(snapshot.machineId)
    const at = this.now()
    if (!previous) {
      this.log(`online user=${userId} machine=${snapshot.machineId}`)
    } else if (previous.offline) {
      this.log(`back online user=${userId} machine=${snapshot.machineId} silentMs=${at - previous.lastSeenAt}`)
    }
    machines.set(snapshot.machineId, { snapshot, lastSeenAt: at, offline: false })
    this.emit()
  }

  /** Graceful quit or sign-out: the machine leaves at once instead of going offline first. */
  remove(userId: string, machineId: string): void {
    const machines = this.users.get(userId)
    if (!machines?.delete(machineId)) {
      return
    }
    this.log(`goodbye user=${userId} machine=${machineId}`)
    if (machines.size === 0) {
      this.users.delete(userId)
    }
    this.emit()
  }

  /** Marks silent machines offline and drops long-silent ones; call on a timer. */
  sweep(): void {
    const at = this.now()
    let changed = false
    for (const [userId, machines] of this.users) {
      for (const [machineId, machine] of machines) {
        const silence = at - machine.lastSeenAt
        if (silence > OFFLINE_AFTER_MS + DROP_AFTER_OFFLINE_MS) {
          machines.delete(machineId)
          this.log(`dropped user=${userId} machine=${machineId} silentMs=${silence}`)
          changed = true
        } else if (silence > OFFLINE_AFTER_MS && !machine.offline) {
          machine.offline = true
          this.log(`offline user=${userId} machine=${machineId} silentMs=${silence}`)
          changed = true
        }
      }
      if (machines.size === 0) {
        this.users.delete(userId)
      }
    }
    if (changed) {
      this.emit()
    }
  }

  /** The org's view: only current members with at least one machine, sorted by name. */
  view(members: WorkViewMember[]): WorkView {
    const devs: WorkViewDev[] = []
    for (const member of members) {
      const machines = this.users.get(member.userId)
      if (!machines) {
        continue
      }
      const all = [...machines.values()]
      devs.push({
        id: member.userId,
        name: member.name,
        machines: all.map((m) => m.snapshot.machineLabel).filter(Boolean),
        status: all.some((m) => !m.offline) ? 'online' : 'offline',
        projects: all.flatMap(({ snapshot }) =>
          snapshot.projects.map((p) => ({
            // Why prefix: project and agent ids are hashes of machine-local ids, unique only per machine.
            id: `${snapshot.machineId}:${p.id}`,
            name: p.name,
            agents: p.agents.map((a) => ({ ...a, id: `${snapshot.machineId}:${a.id}` }))
          }))
        )
      })
    }
    devs.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    return { devs }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener()
    }
  }
}
