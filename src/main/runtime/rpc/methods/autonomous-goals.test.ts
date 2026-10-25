import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { eraseRpcMethods, type RpcContext } from '../core'
import { OrchestrationDb } from '../../orchestration/db'
import { DolphinRuntimeService } from '../../dolphin-runtime'
import { AutonomousGoalStore } from '../../../autonomous-goals/autonomous-goal-store'
import { AUTONOMOUS_GOAL_METHODS } from './autonomous-goals'

const PANE = 'tab_coord:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
let store: AutonomousGoalStore

vi.mock('../../../autonomous-goals/autonomous-goal-store-instance', () => ({
  getAutonomousGoalStore: () => store
}))

describe('goal.* RPC methods', () => {
  let dir: string
  let db: OrchestrationDb
  let ctx: RpcContext

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'goal-rpc-'))
    store = new AutonomousGoalStore(() => join(dir, 'goals.json'))
    db = new OrchestrationDb(':memory:')
    const runtime = new DolphinRuntimeService()
    runtime.setOrchestrationDb(db)
    vi.spyOn(runtime, 'getTerminalPaneKey').mockImplementation((handle) =>
      handle === 'term_coord' ? PANE : null
    )
    vi.spyOn(runtime, 'showTerminal').mockRejectedValue(new Error('not in this test'))
    ctx = { runtime }
  })

  afterEach(() => {
    db.close()
    rmSync(dir, { recursive: true, force: true })
  })

  async function call(name: string, params: Record<string, unknown>): Promise<unknown> {
    const method = eraseRpcMethods(AUTONOMOUS_GOAL_METHODS).find((m) => m.name === name)
    if (!method) {
      throw new Error(`missing ${name}`)
    }
    return method.handler(method.params ? method.params.parse(params) : undefined, ctx)
  }

  const start = {
    from: 'term_coord',
    objective: 'Build the docs site',
    agent: 'claude',
    workerAgent: 'codex',
    maxConcurrent: 2
  }

  it('creates the goal and its Run bound to the coordinator pane, once', async () => {
    expect(await call('goal.start', start)).toMatchObject({ created: true })
    const [goal] = store.list()
    expect(goal.paneKey).toBe(PANE)
    expect(db.getRun(goal.runId)?.objective).toBe('Build the docs site')
    expect(await call('goal.start', start)).toMatchObject({ created: false, goal: { id: goal.id } })
    expect(store.list()).toHaveLength(1)
  })

  it('stores the cleanup choices only when the coordinator passed them', async () => {
    await call('goal.start', start)
    expect(store.list()[0]).not.toHaveProperty('removeWorktrees')
    expect(store.list()[0]).not.toHaveProperty('keepCoordinatorWorktree')
    store.update(store.list()[0]!.id, { status: 'complete' })
    await call('goal.start', { ...start, removeWorktrees: false, keepCoordinatorWorktree: false })
    expect(store.list()[1]).toMatchObject({
      removeWorktrees: false,
      keepCoordinatorWorktree: false
    })
  })

  it('returns the coordinator rules on every start, since the launch prompt carries none', async () => {
    const instructions = expect.stringContaining('Goal:\nBuild the docs site')
    expect(await call('goal.start', start)).toMatchObject({ instructions })
    expect(await call('goal.start', start)).toMatchObject({ created: false, instructions })
  })

  it('tracks blockers, decisions and completion for the calling coordinator', async () => {
    await call('goal.start', start)
    expect(
      await call('goal.note', { from: 'term_coord', kind: 'blocker', text: 'Need an API key' })
    ).toMatchObject({ goal: { status: 'blocked' } })
    expect(
      await call('goal.note', { from: 'term_coord', kind: 'decision', text: 'Use SQLite' })
    ).toMatchObject({ goal: { status: 'active' } })
    expect(await call('goal.complete', { from: 'term_coord', summary: 'Shipped' })).toMatchObject({
      goal: { status: 'complete', notes: [{ kind: 'decision' }] }
    })
    await expect(call('goal.show', { from: 'term_coord' })).rejects.toThrow(/No open goal/)
  })

  it('refuses a caller without a stable terminal pane', async () => {
    await expect(call('goal.start', { ...start, from: 'term_other' })).rejects.toThrow()
  })
})
