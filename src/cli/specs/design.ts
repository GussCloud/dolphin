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
    path: ['design', 'decide'],
    summary: 'Ask the user to settle choices only they can make, shown on the Design screen',
    usage: 'dolphin design decide --id <design_id> --file <path> [--from <handle>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'id', 'file', 'from'],
    notes: [
      'The file holds {"decisions":[{"question","header?","options":[{"label","description?"}],"multiSelect?","blockId?"}]}.',
      'Pass --file - to read it from stdin. Answers arrive in `design inbox`; never poll for them.'
    ]
  },
  {
    path: ['design', 'inbox'],
    summary: "Read the user's pending answers and block comments for a design",
    usage: 'dolphin design inbox --id <design_id> [--from <handle>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'id', 'from'],
    notes: ['Dolphin types a one-line notice into the agent terminal when new input arrives.']
  },
  {
    path: ['design', 'ack'],
    summary: 'Mark inbox items as handled so Dolphin stops announcing them',
    usage:
      'dolphin design ack --id <design_id> --items <item_id,item_id> [--from <handle>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'id', 'items', 'from']
  },
  {
    path: ['design', 'reply'],
    summary: "Answer a user's comment in its block thread",
    usage: 'dolphin design reply --id <design_id> --file <path> [--from <handle>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'id', 'file', 'from'],
    notes: [
      'The file holds {"replyTo":"<message_id>","text"}; pass --file - to read it from stdin.'
    ]
  },
  {
    path: ['design', 'revise-decision'],
    summary: "Record that a later user request changed an answered decision's answer",
    usage:
      'dolphin design revise-decision --id <design_id> --file <path> [--from <handle>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'id', 'file', 'from'],
    notes: [
      'The file holds {"decisionId":"<decision_id>","text":"<what the answer is now>"}; pass --file - to read it from stdin.',
      'Only answered decisions; the Design screen shows the text as the updated answer. Running it again replaces it.'
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
    path: ['design', 'complete'],
    summary: 'Report the approved design implemented, for the user to confirm as done',
    usage: 'dolphin design complete --id <design_id> --file <path> [--from <handle>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'id', 'file', 'from'],
    notes: [
      'The file holds {"summary":"<what was built, files, how it was tested>"}; pass --file - to read it from stdin.',
      'Only while the design is in progress. Running it again replaces the summary. Only the user moves the design to done.'
    ]
  }
]
