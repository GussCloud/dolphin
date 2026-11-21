import type { RuntimeTerminalAgentStatusReading } from '../runtime/runtime-terminal-agent-status-query'

/**
 * The design agent's readiness for an inbox notice. A `monitoring` agent finished its turn and sits
 * at a free prompt while only watch loops run, so it reads as idle; otherwise it would never be told.
 */
export function designAgentStatusFromTerminal(
  terminal: Pick<RuntimeTerminalAgentStatusReading, 'status' | 'workingMode'>
): RuntimeTerminalAgentStatusReading['status'] {
  return terminal.status === 'working' && terminal.workingMode === 'monitoring'
    ? 'idle'
    : terminal.status
}
