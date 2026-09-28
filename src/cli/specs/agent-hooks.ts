import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

export const AGENT_HOOK_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['agent', 'hooks', 'prepare-codex'],
    summary: 'Repair Dolphin-managed Codex hook trust before a shell launch',
    usage: 'dolphin agent hooks prepare-codex',
    allowedFlags: [...GLOBAL_FLAGS]
  },
  {
    path: ['agent', 'hooks', 'status'],
    summary: 'Show whether Dolphin-managed agent status hooks are enabled',
    usage: 'dolphin agent hooks status [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    examples: ['dolphin agent hooks status', 'dolphin agent hooks status --json']
  },
  {
    path: ['agent', 'hooks', 'off'],
    summary: 'Disable Dolphin-managed agent status hooks and remove local hook entries',
    usage: 'dolphin agent hooks off [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    examples: ['dolphin agent hooks off']
  },
  {
    path: ['agent', 'hooks', 'on'],
    summary: 'Enable Dolphin-managed agent status hooks',
    usage: 'dolphin agent hooks on [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    examples: ['dolphin agent hooks on']
  }
]
