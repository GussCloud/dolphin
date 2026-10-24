// Prompts that drive an autonomous goal's coordinator. Kept terse: every line is paid for again
// each time the session is rotated, so rules live here once instead of in a large skill.
import type {
  AutonomousGoal,
  AutonomousGoalAgent,
  AutonomousGoalNote
} from './autonomous-goal-types'

export type AutonomousCoordinatorLaunch = {
  objective: string
  agent: AutonomousGoalAgent
  workerAgent: AutonomousGoalAgent
  maxConcurrent: number
}

/** UTF-8 base64 that works in both Node and the renderer, so the objective survives any shell quoting. */
export function encodeAutonomousGoalObjective(objective: string): string {
  const bytes = new TextEncoder().encode(objective)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

export function decodeAutonomousGoalObjective(encoded: string): string {
  const binary = atob(encoded.trim())
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

function coordinatorRules(workerAgent: AutonomousGoalAgent, maxConcurrent: number): string[] {
  return [
    'Rules:',
    '- You coordinate; you do not implement. Read the repository docs once, then split the goal into Tasks with only real dependencies (`dolphin orchestration task-create --spec "..." --deps \'["<task_id>"]\' --json`).',
    `- Start each ready Task in its own worktree: \`dolphin orchestration worker-start --task <task_id> --worktree new-top-level --name <short-slug> --agent ${workerAgent} --json\`. Keep at most ${maxConcurrent} workers running.`,
    "- Each worker spec must say: implement the task, run the repo's checks, open a PR (or MR), drive its CI to green, enable auto-merge so it merges once green, then report worker_done with the PR URL in at most two lines.",
    "- A Task that depends on another starts only after the dependency's PR is merged; its worktree must branch from the updated base.",
    '- After starting or answering workers, end your turn and stay idle: Dolphin types a notice into this terminal when Run mail arrives. Never use `check --wait` or poll. On each notice, read with `dolphin orchestration check --json`, act, then acknowledge with `dolphin orchestration check --ack <delivery_id> --json`.',
    '- Do not read diffs or worker transcripts; act only on the reports. Keep your own replies short.',
    '- If worker-start refuses with goal_usage_limited, start nothing else and end your turn; Dolphin wakes this terminal when the plan window resets.',
    '- Record anything a successor must know as one line: `dolphin goal note --kind decision --text "..."`.',
    '- This session can be replaced by a fresh one at any turn end; the Run, its Tasks and the goal notes are the only memory that survives.',
    '- Ask the user only for a decision you cannot make: `dolphin goal note --kind blocker --text "..."`, then keep waiting on the Run.',
    '- When every Task is done, every PR is merged and the goal is met: `dolphin goal complete --summary "<one line>" --json`, then stop.'
  ]
}

export function buildAutonomousCoordinatorLaunchPrompt(
  launch: AutonomousCoordinatorLaunch
): string {
  const objective = launch.objective.trim()
  return [
    'You are the autonomous coordinator of this goal. Work until it is complete; do not stop to ask for confirmation.',
    '',
    'Goal:',
    objective,
    '',
    'First, bind this terminal to the goal (it also creates the orchestration Run):',
    `\`dolphin goal start --agent ${launch.agent} --worker-agent ${launch.workerAgent} --max-concurrent ${launch.maxConcurrent} --objective-b64 ${encodeAutonomousGoalObjective(objective)} --json\``,
    'Then load the coordination contract once: `dolphin skills get orchestration`.',
    '',
    ...coordinatorRules(launch.workerAgent, launch.maxConcurrent)
  ].join('\n')
}

export type AutonomousGoalTaskLine = {
  id: string
  status: string
  spec: string
}

const RESUME_TASK_LIMIT = 40
const RESUME_TASK_SPEC_CHARS = 100

function oneLine(text: string, maxChars: number): string {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  return collapsed.length > maxChars ? `${collapsed.slice(0, maxChars - 1)}…` : collapsed
}

function noteLines(notes: AutonomousGoalNote[], kind: AutonomousGoalNote['kind']): string[] {
  return notes.filter((note) => note.kind === kind).map((note) => `- ${oneLine(note.text, 300)}`)
}

/** Built from stored state, not from a model summary, so a rotation cannot lose or invent facts. */
export function buildAutonomousCoordinatorResumePrompt(
  goal: AutonomousGoal,
  tasks: readonly AutonomousGoalTaskLine[]
): string {
  const shown = tasks.slice(0, RESUME_TASK_LIMIT)
  const taskLines =
    shown.length === 0
      ? ['- (no Tasks yet)']
      : shown.map(
          (task) => `- ${task.id} [${task.status}] ${oneLine(task.spec, RESUME_TASK_SPEC_CHARS)}`
        )
  if (tasks.length > shown.length) {
    taskLines.push(
      `- … ${tasks.length - shown.length} more: \`dolphin orchestration task-list --brief --json\``
    )
  }
  const decisions = noteLines(goal.notes, 'decision')
  const handoff = noteLines(goal.notes, 'handoff')
  const blockers = noteLines(goal.notes, 'blocker')
  return [
    'You are continuing as the autonomous coordinator of this goal in a fresh session. This terminal is already bound to the goal and its Run; do not run `dolphin goal start` or create another Run.',
    '',
    'Goal:',
    goal.objective,
    '',
    `Run: ${goal.runId}. Worker agent: ${goal.workerAgent}. Max concurrent workers: ${goal.maxConcurrent}.`,
    '',
    'Tasks:',
    ...taskLines,
    ...(decisions.length > 0 ? ['', 'Decisions so far:', ...decisions] : []),
    ...(handoff.length > 0 ? ['', 'Handoff from the previous session:', ...handoff] : []),
    ...(blockers.length > 0 ? ['', 'Open blockers:', ...blockers] : []),
    '',
    'Load the coordination contract once: `dolphin skills get orchestration`. Then read unread mail with `dolphin orchestration check --json` and continue; if there is none, end your turn and wait idle.',
    '',
    ...coordinatorRules(goal.workerAgent, goal.maxConcurrent)
  ].join('\n')
}

/** In-place session reset: the pane, its terminal binding and its Run survive; the conversation does not. */
export const AUTONOMOUS_COORDINATOR_RESET_COMMAND: Record<AutonomousGoalAgent, string> = {
  claude: '/clear',
  codex: '/new'
}

export const AUTONOMOUS_COORDINATOR_HANDOFF_REQUEST =
  'Dolphin is about to replace this session with a fresh one to keep the context small. In one command, save what the next session needs that is not already in the Run, Tasks or goal notes (open threads, what you were about to do): `dolphin goal note --kind handoff --text "<at most 1200 characters>"`. Reply with nothing else and do not start new work.'
