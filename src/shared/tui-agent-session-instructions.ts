import { isTuiAgent } from './tui-agent-config'
import { quoteStartupArg, type AgentStartupShell } from './tui-agent-startup-shell'
import type { TuiAgent } from './tui-agent'

/** Agents whose CLI accepts `--append-system-prompt`; only these expose the setting. */
export const TUI_AGENTS_WITH_SESSION_INSTRUCTIONS: readonly TuiAgent[] = ['claude-agent-teams']

// Why a cap: the text rides on the launch command line, and Windows caps one at ~8K (cmd).
export const MAX_TUI_AGENT_SESSION_INSTRUCTIONS_LENGTH = 2000

const DEFAULT_TUI_AGENT_SESSION_INSTRUCTIONS: Partial<Record<TuiAgent, string>> = {
  'claude-agent-teams':
    'You are running with Claude Code Agent Teams enabled. For any non-trivial task with independent parts ' +
    '(research, analysis, implementation, review), create an agent team and split the work among teammates ' +
    'instead of doing everything alone. Work solo only for small, single-step requests.'
}

const SYSTEM_PROMPT_FLAG_PATTERN = /(^|\s)--(?:append-)?system-prompt(?:-file)?(?:\s|=|$)/

export function supportsTuiAgentSessionInstructions(agent: TuiAgent): boolean {
  return TUI_AGENTS_WITH_SESSION_INSTRUCTIONS.includes(agent)
}

export function getTuiAgentDefaultSessionInstructions(agent: TuiAgent): string {
  return DEFAULT_TUI_AGENT_SESSION_INSTRUCTIONS[agent] ?? ''
}

function sanitizeSessionInstructions(value: string): string {
  return value.trim().slice(0, MAX_TUI_AGENT_SESSION_INSTRUCTIONS_LENGTH)
}

export function normalizeTuiAgentSessionInstructionsRecord(
  value: unknown
): Partial<Record<TuiAgent, string>> {
  const normalized: Partial<Record<TuiAgent, string>> = {}
  if (!value || typeof value !== 'object') {
    return normalized
  }
  for (const [agent, text] of Object.entries(value)) {
    if (!isTuiAgent(agent) || typeof text !== 'string') {
      continue
    }
    normalized[agent] = sanitizeSessionInstructions(text)
  }
  return normalized
}

/** Configured text wins, including an empty string (the user turned it off); absent falls back to the default. */
export function resolveTuiAgentSessionInstructions(
  agent: TuiAgent,
  configured: Partial<Record<TuiAgent, string>> | null | undefined
): string | null {
  if (!supportsTuiAgentSessionInstructions(agent)) {
    return null
  }
  const text =
    configured && Object.hasOwn(configured, agent) && typeof configured[agent] === 'string'
      ? (configured[agent] ?? '')
      : getTuiAgentDefaultSessionInstructions(agent)
  return sanitizeSessionInstructions(text) || null
}

/**
 * Appends the instructions as `--append-system-prompt` so they hold for the whole session,
 * including a first message typed straight into the terminal.
 */
export function appendSessionInstructionsArg(args: {
  command: string
  instructions: string | null | undefined
  /** User-configured args; an explicit system-prompt flag there wins over Dolphin's. */
  agentArgs?: string | null
  shell: AgentStartupShell
}): string {
  const instructions = args.instructions?.trim()
  if (
    !instructions ||
    SYSTEM_PROMPT_FLAG_PATTERN.test(args.command) ||
    SYSTEM_PROMPT_FLAG_PATTERN.test(args.agentArgs ?? '')
  ) {
    return args.command
  }
  // Why one line: cmd.exe cannot carry a newline inside a quoted argument.
  const singleLine = sanitizeSessionInstructions(instructions.replace(/\s*[\r\n]+\s*/g, ' '))
  return `${args.command} --append-system-prompt ${quoteStartupArg(singleLine, args.shell)}`
}
