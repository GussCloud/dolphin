import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

export const GOAL_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['goal', 'start'],
    summary: 'Bind this coordinator terminal to a new autonomous goal and create its Run',
    usage:
      'dolphin goal start (--objective <text> | --objective-b64 <base64>) --agent <goal-agent> --worker-agent <goal-agent> [--max-concurrent <n>] [--keep-worktrees] [--remove-coordinator-worktree] [--from <handle>] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'objective',
      'objective-b64',
      'agent',
      'worker-agent',
      'max-concurrent',
      'keep-worktrees',
      'remove-coordinator-worktree',
      'from'
    ],
    notes: [
      'Goal agents: claude, claude-agent-teams, codex, deepseek, deepseek-agent-teams.',
      'Repeating it in the same terminal returns the open goal instead of creating another.',
      'By default settled workers are released and their worktrees removed, while the coordinator keeps its own worktree. --keep-worktrees keeps every worktree and terminal; --remove-coordinator-worktree also removes the coordinator worktree once the goal completes.'
    ]
  },
  {
    path: ['goal', 'note'],
    summary: 'Record a one-line decision, a handoff for the next session, or a blocker',
    usage:
      'dolphin goal note --kind <decision|handoff|blocker> --text <text> [--from <handle>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'kind', 'text', 'from'],
    notes: ['A handoff or blocker replaces the previous one; decisions accumulate up to a cap.']
  },
  {
    path: ['goal', 'complete'],
    summary: "Mark this coordinator's goal complete",
    usage: 'dolphin goal complete --summary <text> [--from <handle>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'summary', 'from']
  },
  {
    path: ['goal', 'show'],
    summary: "Show a goal by id, or this coordinator's open goal",
    usage: 'dolphin goal show [--id <goal_id>] [--from <handle>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'id', 'from']
  },
  {
    path: ['goal', 'list'],
    summary: 'List autonomous goals on this host',
    usage: 'dolphin goal list [--json]',
    allowedFlags: [...GLOBAL_FLAGS]
  },
  {
    path: ['goal', 'stop'],
    summary: 'Stop an autonomous goal; its Run, Tasks and workers are left as they are',
    usage: 'dolphin goal stop --id <goal_id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'id']
  }
]
