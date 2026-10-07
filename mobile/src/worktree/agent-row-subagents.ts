import type { AgentSubagentState } from '../../../src/shared/agent-status-types'
import type { RuntimeWorktreeAgentRow } from '../../../src/shared/runtime-types'
import { AGENT_STATUS_STALE_AFTER_MS, type AgentDotState } from './agent-row-display'

/** A live in-process teammate/subagent of a pane, shown as a child row under its leader. */
export type AgentRowSubagent = {
  id: string
  name: string
  dotState: AgentDotState
  stateLabel: string
  startedAt: number
}

const SUBAGENT_STATES: readonly AgentSubagentState[] = [
  'working',
  'blocked',
  'waiting',
  'idle',
  'unverifiable'
]
// Why: mirrors AGENT_STATUS_MAX_SUBAGENTS so a malformed row cannot flood the card.
const MAX_SUBAGENT_ROWS = 50

function isSubagentState(value: unknown): value is AgentSubagentState {
  return SUBAGENT_STATES.some((state) => state === value)
}

function optionalText(record: object, key: string): string | null {
  const value: unknown = Reflect.get(record, key)
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/**
 * Reads the optional `subagents` a host may publish on a worktree.ps agent row.
 * Old hosts send none; malformed entries are dropped instead of failing the row.
 */
export function readAgentRowSubagents(
  row: Pick<RuntimeWorktreeAgentRow, 'updatedAt' | 'stateStartedAt'>,
  now: number
): AgentRowSubagent[] {
  const raw: unknown = Reflect.get(row, 'subagents')
  if (!Array.isArray(raw)) {
    return []
  }
  // Why: a stale leader proves nothing about its teammates; an active state there is unverifiable.
  const parentFresh = now - row.updatedAt <= AGENT_STATUS_STALE_AFTER_MS
  const out: AgentRowSubagent[] = []
  for (const entry of raw.slice(0, MAX_SUBAGENT_ROWS)) {
    if (typeof entry !== 'object' || entry === null) {
      continue
    }
    const id = optionalText(entry, 'id')
    const state: unknown = Reflect.get(entry, 'state')
    if (!id || !isSubagentState(state)) {
      continue
    }
    const startedAt: unknown = Reflect.get(entry, 'startedAt')
    const effective = !parentFresh && state !== 'idle' ? 'unverifiable' : state
    out.push({
      id,
      name: optionalText(entry, 'description') ?? optionalText(entry, 'agentType') ?? 'Teammate',
      dotState: effective === 'unverifiable' ? 'idle' : effective,
      stateLabel: subagentStateLabel(effective),
      startedAt: typeof startedAt === 'number' && startedAt > 0 ? startedAt : row.stateStartedAt
    })
  }
  return out
}

function subagentStateLabel(state: AgentSubagentState): string {
  switch (state) {
    case 'working':
      return 'Working'
    case 'blocked':
      return 'Blocked'
    case 'waiting':
      return 'Waiting for input'
    case 'idle':
      return 'Idle'
    case 'unverifiable':
      return 'Unverifiable'
  }
}

/** Change signature for list-equality checks; the row type does not declare `subagents`. */
export function agentRowSubagentsSignature(row: RuntimeWorktreeAgentRow): string {
  const raw: unknown = Reflect.get(row, 'subagents')
  return Array.isArray(raw) ? JSON.stringify(raw) : ''
}
