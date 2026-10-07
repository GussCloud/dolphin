import type { AgentSubagentState } from '../../../src/shared/agent-status-types'
import type { RuntimeWorktreeAgentRow } from '../../../src/shared/runtime-types'
import { AGENT_STATUS_STALE_AFTER_MS, type AgentDotState } from './agent-row-display'
import { worktreeCatalog } from '../i18n/catalogs/worktree'
import { translate } from '../i18n/mobile-locale-state'

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

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/**
 * Reads the optional `subagents` a host may publish on a worktree.ps agent row.
 * Old hosts send none; malformed entries are dropped instead of failing the row.
 */
export function readAgentRowSubagents(
  // Why unknown: the host is a different build, so entries are re-validated here.
  row: Pick<RuntimeWorktreeAgentRow, 'updatedAt' | 'stateStartedAt'> & { subagents?: unknown },
  now: number
): AgentRowSubagent[] {
  const raw = row.subagents
  if (!Array.isArray(raw)) {
    return []
  }
  // Why: a stale leader proves nothing about its teammates; an active state there is unverifiable.
  const parentFresh = now - row.updatedAt <= AGENT_STATUS_STALE_AFTER_MS
  const out: AgentRowSubagent[] = []
  for (const entry of raw.slice(0, MAX_SUBAGENT_ROWS)) {
    const subagent = parseSubagentEntry(entry)
    if (!subagent) {
      continue
    }
    const { id, state, startedAt } = subagent
    const effective = !parentFresh && state !== 'idle' ? 'unverifiable' : state
    out.push({
      id,
      name: subagent.name ?? translate(worktreeCatalog, 'teammate'),
      dotState: effective === 'unverifiable' ? 'idle' : effective,
      stateLabel: subagentStateLabel(effective),
      startedAt: startedAt ?? row.stateStartedAt
    })
  }
  return out
}

type ParsedSubagentEntry = {
  id: string
  state: AgentSubagentState
  name: string | null
  startedAt: number | null
}

function parseSubagentEntry(entry: unknown): ParsedSubagentEntry | null {
  if (typeof entry !== 'object' || entry === null) {
    return null
  }
  const fields: Partial<
    Record<'id' | 'state' | 'description' | 'agentType' | 'startedAt', unknown>
  > = { ...entry }
  const id = optionalText(fields.id)
  if (!id || !isSubagentState(fields.state)) {
    return null
  }
  return {
    id,
    state: fields.state,
    name: optionalText(fields.description) ?? optionalText(fields.agentType),
    startedAt:
      typeof fields.startedAt === 'number' && fields.startedAt > 0 ? fields.startedAt : null
  }
}

function subagentStateLabel(state: AgentSubagentState): string {
  switch (state) {
    case 'working':
      return translate(worktreeCatalog, 'agentWorking')
    case 'blocked':
      return translate(worktreeCatalog, 'agentBlocked')
    case 'waiting':
      return translate(worktreeCatalog, 'agentWaiting')
    case 'idle':
      return translate(worktreeCatalog, 'agentIdle')
    case 'unverifiable':
      return translate(worktreeCatalog, 'agentUnverifiable')
  }
}

/** Change signature for list-equality checks. */
export function agentRowSubagentsSignature(row: RuntimeWorktreeAgentRow): string {
  return row.subagents?.length ? JSON.stringify(row.subagents) : ''
}
