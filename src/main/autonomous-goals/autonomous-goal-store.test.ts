import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AUTONOMOUS_GOAL_MAX_DECISIONS } from '../../shared/autonomous-goal-types'
import { AutonomousGoalStore, type AutonomousGoalCreate } from './autonomous-goal-store'

const INPUT: AutonomousGoalCreate = {
  objective: 'Ship it',
  agent: 'claude',
  workerAgent: 'codex',
  maxConcurrent: 2,
  paneKey: 'tab-1:leaf-1',
  worktreeId: 'wt-1',
  runId: 'run_1'
}

describe('AutonomousGoalStore', () => {
  let dir: string
  let file: string
  let clock: number

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'goal-store-'))
    file = join(dir, 'autonomous-goals.json')
    clock = 1_000
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  const store = (): AutonomousGoalStore =>
    new AutonomousGoalStore(
      () => file,
      () => clock++
    )

  it('persists goals and finds the open one for a coordinator pane', () => {
    const created = store().create(INPUT)
    const reopened = store()
    expect(reopened.findOpenByPane('tab-1:leaf-1')?.id).toBe(created.id)
    reopened.update(created.id, { status: 'complete' })
    expect(store().findOpenByPane('tab-1:leaf-1')).toBeNull()
    expect(JSON.parse(readFileSync(file, 'utf-8'))).toHaveLength(1)
  })

  it('caps decisions and keeps only the newest handoff', () => {
    const goals = store()
    const goal = goals.create(INPUT)
    for (let index = 0; index < AUTONOMOUS_GOAL_MAX_DECISIONS + 5; index += 1) {
      goals.addNote(goal.id, 'decision', `decision ${index}`)
    }
    goals.addNote(goal.id, 'handoff', 'first')
    const latest = goals.addNote(goal.id, 'handoff', 'second')
    const decisions = latest.notes.filter((note) => note.kind === 'decision')
    expect(decisions).toHaveLength(AUTONOMOUS_GOAL_MAX_DECISIONS)
    expect(decisions[0].text).toBe('decision 5')
    expect(latest.notes.filter((note) => note.kind === 'handoff').map((note) => note.text)).toEqual(
      ['second']
    )
  })

  it('ignores a corrupt file instead of failing every goal call', () => {
    const goals = store()
    goals.create(INPUT)
    writeFileSync(file, '{not json')
    expect(store().list()).toEqual([])
  })

  it('notifies subscribers of every write', () => {
    const goals = store()
    const seen: string[] = []
    const dispose = goals.subscribe((goal) => seen.push(goal.status))
    const goal = goals.create(INPUT)
    goals.update(goal.id, { status: 'blocked' })
    dispose()
    goals.update(goal.id, { status: 'active' })
    expect(seen).toEqual(['active', 'blocked'])
  })
})
