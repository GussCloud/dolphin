import { DESIGN_BLOCK_KINDS, type Design } from './design-types'

/**
 * The design agent's argv prompt: one line of shell-inert characters, because it is typed into
 * whatever shell the terminal runs. The request and the rules travel in `design start`'s output.
 */
export function buildDesignLaunchPrompt(designId: string): string {
  return [
    'You are the design agent of a Dolphin Design.',
    `First run: dolphin design start --id ${designId} --json`,
    'Then follow the instructions field it returns.'
  ].join(' ')
}

/** Without it an answered decision keeps showing the old answer after the user asks for something else. */
function reviseDecisionRule(designId: string): string {
  return `When a later request from the user changes what an answered decision says, record it: write {"decisionId","text"} (the answer as it is now) to a file and run \`dolphin design revise-decision --id ${designId} --file <path> --json\`.`
}

/** Returned by `design start`, so the rules reach the model as tool output, never through a shell. */
export function buildDesignAgentInstructions(
  design: Pick<Design, 'id' | 'name' | 'request' | 'status'>,
  canvasVersion?: number
): string {
  // Why: an agent restarted after approval must keep implementing, not go back to planning.
  const stage =
    design.status === 'draft'
      ? []
      : ['', 'Current stage:', buildDesignStatusNotice(design, design.status, canvasVersion)]
  return [
    `This terminal is now bound to the design "${design.name}".`,
    '',
    'What the user wants to build:',
    design.request,
    '',
    'Rules:',
    design.status === 'draft'
      ? '- Study this repository first so the flow matches how the project really works. Do not change any file: this design is in planning.'
      : '- Study this repository first so the work matches how the project really works.',
    '- Draw the complete flow of the request as a canvas: groups are the steps of the flow (in order), each holding stacked blocks; edges connect a group (or one of its blocks, for branches) to the group the flow continues in.',
    `- Block kinds: ${DESIGN_BLOCK_KINDS.join(', ')}. Use "decision" for branches and give each branch its own edge with a label.`,
    `- Write the canvas as JSON {"groups":[{"id","title","blocks":[{"id","kind","title","description"}]}],"edges":[{"id","fromGroupId","fromBlockId?","toGroupId","label?"}],"summary"} to a file, then run \`dolphin design canvas-set --id ${design.id} --file <path> --json\`. Ids are short and unique; positions are optional, Dolphin lays the canvas out.`,
    '- If the tool refuses the canvas, fix what its error names and run it again.',
    `- When something only the user can settle blocks the design (a product choice, a trade-off), do not guess: write {"decisions":[{"question","header?","options":[{"label","description?"}],"multiSelect?","blockId?"}]} to a file and run \`dolphin design decide --id ${design.id} --file <path> --json\`. Keep drawing what does not depend on it. An answer with an empty "selected" is the user's own answer, written in its "note".`,
    '- After the canvas is accepted (and any decision is asked), reply with a short summary and end your turn: the user reviews it on the Design screen. Never poll and never wait in a loop.',
    `- Dolphin types a one-line notice into this terminal when the user answers a decision or comments on a block. Then run \`dolphin design inbox --id ${design.id} --json\`, act on every item (update the canvas with canvas-set when the user asked for a change), answer each comment by writing {"replyTo","text"} to a file and running \`dolphin design reply --id ${design.id} --file <path> --json\`, and acknowledge with \`dolphin design ack --id ${design.id} --items <id,id> --json\`. Unacked items keep the notices coming.`,
    `- ${reviseDecisionRule(design.id)}`,
    ...stage
  ].join('\n')
}

/** What `design inbox` tells the agent when the user moved the design; one place for every status. */
export function buildDesignStatusNotice(
  design: Pick<Design, 'id'>,
  status: Design['status'],
  canvasVersion: number | undefined
): string {
  switch (status) {
    case 'in-progress':
      return [
        `The user approved the design${canvasVersion === undefined ? '' : ` (canvas version ${canvasVersion})`}. Implement it now in this worktree, exactly as drawn: every group and block, every branch, and the decisions the user answered.`,
        "Follow the repository's conventions, add or update tests, run them, and commit on this worktree's branch. Do not open a pull request unless the user asks for one.",
        'Keep using decide/reply if something only the user can settle comes up; update the canvas with canvas-set if the implementation must differ from the drawing, and say why in a reply.',
        reviseDecisionRule(design.id),
        `When it is implemented and the tests pass, write {"summary":"<what you built, files, how it was tested>"} to a file and run \`dolphin design complete --id ${design.id} --file <path> --json\`, then end your turn. The user confirms it or sends what is left.`
      ].join(' ')
    case 'discarded':
      return 'The user discarded this design. Stop working on it now: do not change or commit anything else, and end your turn.'
    case 'draft':
      return 'The user moved this design back to planning. Stop implementing, do not change files, and keep refining the canvas and decisions with the user.'
    case 'done':
      return 'The user confirmed the design is done. Nothing else to do; end your turn.'
  }
}
