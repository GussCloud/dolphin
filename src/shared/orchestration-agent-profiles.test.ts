import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ORCHESTRATION_AGENT,
  DEFAULT_ORCHESTRATION_AGENT_ID,
  findOrchestrationAgent,
  listOrchestrationAgents,
  normalizeOrchestrationAgents
} from './orchestration-agent-profiles'

const custom = {
  id: 'reviewer',
  name: '  Strict reviewer ',
  description: 'Small Tasks',
  coordinatorAgent: 'codex' as const,
  workerAgent: 'claude-agent-teams' as const,
  maxConcurrent: 3,
  strategy: 'Every PR needs tests.'
}

describe('normalizeOrchestrationAgents', () => {
  it('keeps valid agents, trimmed', () => {
    expect(normalizeOrchestrationAgents([custom])).toEqual([
      { ...custom, name: 'Strict reviewer' }
    ])
  })

  it('drops rows that are malformed, duplicated or shadow the built-in agent', () => {
    expect(
      normalizeOrchestrationAgents([
        null,
        { ...custom, name: '' },
        custom,
        { ...custom, name: 'Again' },
        { ...custom, id: DEFAULT_ORCHESTRATION_AGENT_ID }
      ]).map((agent) => agent.name)
    ).toEqual(['Strict reviewer'])
    expect(normalizeOrchestrationAgents('nope')).toEqual([])
  })

  it('falls back to the default agents and clamps parallelism', () => {
    expect(
      normalizeOrchestrationAgents([
        { ...custom, coordinatorAgent: 'gemini', workerAgent: 1, maxConcurrent: 99 }
      ])[0]
    ).toMatchObject({ coordinatorAgent: 'claude', workerAgent: 'claude', maxConcurrent: 6 })
  })
})

describe('listOrchestrationAgents', () => {
  it('puts Dolphin agent first and resolves an unknown id to it', () => {
    expect(listOrchestrationAgents([custom]).map((agent) => agent.id)).toEqual([
      DEFAULT_ORCHESTRATION_AGENT_ID,
      'reviewer'
    ])
    expect(findOrchestrationAgent([custom], 'reviewer').name).toBe('Strict reviewer')
    expect(findOrchestrationAgent([custom], 'gone')).toBe(DEFAULT_ORCHESTRATION_AGENT)
  })
})
