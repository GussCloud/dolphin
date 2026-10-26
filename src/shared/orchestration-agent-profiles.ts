// Orchestration agents the composer's Orchestration mode offers. Each one presets the goal's
// coordinator, workers and parallelism and adds a strategy after Dolphin's own coordinator rules,
// which stay fixed: an agent never replaces the protocol that keeps a goal moving.
import {
  AUTONOMOUS_GOAL_AGENT_NAME_MAX_CHARS,
  AUTONOMOUS_GOAL_DEFAULT_MAX_CONCURRENT,
  AUTONOMOUS_GOAL_GUIDANCE_MAX_CHARS,
  clampAutonomousGoalMaxConcurrent,
  isAutonomousGoalAgent,
  type AutonomousGoalAgent
} from './autonomous-goal-types'

export type OrchestrationAgentProfile = {
  id: string
  name: string
  description: string
  coordinatorAgent: AutonomousGoalAgent
  workerAgent: AutonomousGoalAgent
  maxConcurrent: number
  /** Appended after Dolphin's rules; empty for the built-in agent, whose rules are the strategy. */
  strategy: string
}

export const DEFAULT_ORCHESTRATION_AGENT_ID = 'dolphin-orchestrator'
export const MAX_ORCHESTRATION_AGENTS = 30
export const ORCHESTRATION_AGENT_DESCRIPTION_MAX_CHARS = 200
const MAX_ID_CHARS = 80

/** Dolphin's own agent: the coordinator rules as they ship, no extra strategy. */
export const DEFAULT_ORCHESTRATION_AGENT: OrchestrationAgentProfile = {
  id: DEFAULT_ORCHESTRATION_AGENT_ID,
  name: 'Dolphin Orchestrator',
  description:
    'Plans the goal as Tasks, starts one worker per Task, answers questions, retries a stalled worker once and finishes when every PR is merged.',
  coordinatorAgent: 'claude',
  workerAgent: 'claude',
  maxConcurrent: AUTONOMOUS_GOAL_DEFAULT_MAX_CONCURRENT,
  strategy: ''
}

function text(value: unknown, maxChars: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxChars) : ''
}

/** Drops malformed rows and the built-in id, so a stored list can never shadow Dolphin's agent. */
export function normalizeOrchestrationAgents(input: unknown): OrchestrationAgentProfile[] {
  if (!Array.isArray(input)) {
    return []
  }
  const seen = new Set<string>([DEFAULT_ORCHESTRATION_AGENT_ID])
  const agents: OrchestrationAgentProfile[] = []
  for (const row of input) {
    if (!row || typeof row !== 'object' || agents.length >= MAX_ORCHESTRATION_AGENTS) {
      continue
    }
    const record: Record<string, unknown> = { ...row }
    const id = text(record.id, MAX_ID_CHARS)
    const name = text(record.name, AUTONOMOUS_GOAL_AGENT_NAME_MAX_CHARS)
    if (!id || !name || seen.has(id)) {
      continue
    }
    seen.add(id)
    agents.push({
      id,
      name,
      description: text(record.description, ORCHESTRATION_AGENT_DESCRIPTION_MAX_CHARS),
      coordinatorAgent: isAutonomousGoalAgent(record.coordinatorAgent)
        ? record.coordinatorAgent
        : DEFAULT_ORCHESTRATION_AGENT.coordinatorAgent,
      workerAgent: isAutonomousGoalAgent(record.workerAgent)
        ? record.workerAgent
        : DEFAULT_ORCHESTRATION_AGENT.workerAgent,
      maxConcurrent: clampAutonomousGoalMaxConcurrent(
        typeof record.maxConcurrent === 'number' ? record.maxConcurrent : undefined
      ),
      strategy: text(record.strategy, AUTONOMOUS_GOAL_GUIDANCE_MAX_CHARS)
    })
  }
  return agents
}

/** Dolphin's agent first, then the user's. */
export function listOrchestrationAgents(
  custom: readonly OrchestrationAgentProfile[] | undefined
): OrchestrationAgentProfile[] {
  return [DEFAULT_ORCHESTRATION_AGENT, ...normalizeOrchestrationAgents(custom ?? [])]
}

export function findOrchestrationAgent(
  custom: readonly OrchestrationAgentProfile[] | undefined,
  id: string | undefined
): OrchestrationAgentProfile {
  return (
    listOrchestrationAgents(custom).find((agent) => agent.id === id) ?? DEFAULT_ORCHESTRATION_AGENT
  )
}
