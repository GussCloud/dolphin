import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

export const STORAGE_GC_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['gc'],
    summary: 'Reclaim disk held by old terminal session history',
    usage: 'orca gc [--dry-run] [--older-than <30d>] [--max-size <5GB>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'dry-run', 'older-than', 'max-size'],
    notes: [
      'Never removes history for a session the daemon still runs, one a saved tab can still restore, one under crash-recovery protection, or anything active in the last 24 hours.',
      'Refuses to remove anything when a terminal daemon does not answer, since its sessions cannot be proven gone.',
      'Defaults: older than 30d, then oldest first until the total fits under 5GB.'
    ],
    examples: ['orca gc --dry-run', 'orca gc --older-than 14d', 'orca gc --max-size 2GB --json']
  }
]
