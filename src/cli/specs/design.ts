import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

export const DESIGN_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['design', 'start'],
    summary: 'Bind this agent terminal to a design and print its request and rules',
    usage: 'dolphin design start --id <design_id> [--from <handle>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'id', 'from'],
    notes: ['Running it again from a new terminal rebinds the design to that terminal.']
  },
  {
    path: ['design', 'canvas-set'],
    summary: "Replace a design's canvas with the JSON in a file, as a new version",
    usage: 'dolphin design canvas-set --id <design_id> --file <path> [--from <handle>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'id', 'file', 'from'],
    notes: [
      'Only the terminal bound by `design start` may write the canvas.',
      'Pass --file - to read the canvas from stdin.'
    ]
  },
  {
    path: ['design', 'show'],
    summary: 'Show a design with its canvas versions and event log',
    usage: 'dolphin design show --id <design_id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'id']
  },
  {
    path: ['design', 'list'],
    summary: 'List designs on this host, most recently updated first',
    usage: 'dolphin design list [--json]',
    allowedFlags: [...GLOBAL_FLAGS]
  },
  {
    path: ['design', 'status'],
    summary: "Move a design's status",
    usage:
      'dolphin design status --id <design_id> --status <draft|in-progress|done|discarded> [--from <handle>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'id', 'status', 'from'],
    notes: ["Run from the bound agent terminal, the move is recorded as the agent's."]
  }
]
