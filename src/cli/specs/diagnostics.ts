import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

export const DIAGNOSTICS_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['diagnostics', 'memory'],
    summary: 'Collect a memory snapshot for Orca and managed terminals',
    usage: 'orca diagnostics memory [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    notes: [
      'Runs the same host process sweep used by the Resource Usage popover, so call it when you need a point-in-time diagnostic rather than a cheap heartbeat.'
    ],
    examples: ['orca diagnostics memory --json']
  },
  {
    path: ['diagnostics', 'runtime'],
    summary: 'Report sessions, PTYs, processes, memory, and disk used by Orca',
    usage: 'orca diagnostics runtime [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    notes: [
      'Cross-checks the PTYs Orca tracks against the terminal daemon and the OS. Inconsistencies are suspects to investigate, not proof a process is orphaned; nothing is killed.',
      'Also walks Orca-owned storage (terminal history, Codex homes, logs), so it is slower than `diagnostics memory`.'
    ],
    examples: ['orca diagnostics runtime', 'orca diagnostics runtime --json']
  }
]
