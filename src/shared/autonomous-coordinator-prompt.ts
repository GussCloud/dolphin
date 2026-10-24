// Prompts that drive an autonomous goal's coordinator. Kept terse: every line is paid for again
// each time the session is rotated, so rules live here once instead of in a large skill.
import type { AutonomousGoalAgent } from './autonomous-goal-types'

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
    '- Wait with `dolphin orchestration check --wait --json`. Do not poll, read diffs or read worker transcripts; act only on the reports. Keep your own replies short.',
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
