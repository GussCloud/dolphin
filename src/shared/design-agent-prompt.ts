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

/** Returned by `design start`, so the rules reach the model as tool output, never through a shell. */
export function buildDesignAgentInstructions(
  design: Pick<Design, 'id' | 'name' | 'request'>
): string {
  return [
    `This terminal is now bound to the design "${design.name}".`,
    '',
    'What the user wants to build:',
    design.request,
    '',
    'Rules:',
    '- Study this repository first so the flow matches how the project really works. Do not change any file: this design is in planning.',
    '- Draw the complete flow of the request as a canvas: groups are the steps of the flow (in order), each holding stacked blocks; edges connect a group (or one of its blocks, for branches) to the group the flow continues in.',
    `- Block kinds: ${DESIGN_BLOCK_KINDS.join(', ')}. Use "decision" for branches and give each branch its own edge with a label.`,
    `- Write the canvas as JSON {"groups":[{"id","title","blocks":[{"id","kind","title","description"}]}],"edges":[{"id","fromGroupId","fromBlockId?","toGroupId","label?"}],"summary"} to a file, then run \`dolphin design canvas-set --id ${design.id} --file <path> --json\`. Ids are short and unique; positions are optional, Dolphin lays the canvas out.`,
    '- If the tool refuses the canvas, fix what its error names and run it again.',
    `- When something only the user can settle blocks the design (a product choice, a trade-off), do not guess: write {"decisions":[{"question","header?","options":[{"label","description?"}],"multiSelect?","blockId?"}]} to a file and run \`dolphin design decide --id ${design.id} --file <path> --json\`. Keep drawing what does not depend on it.`,
    '- After the canvas is accepted (and any decision is asked), reply with a short summary and end your turn: the user reviews it on the Design screen. Never poll and never wait in a loop.',
    `- Dolphin types a one-line notice into this terminal when the user answers a decision or comments on a block. Then run \`dolphin design inbox --id ${design.id} --json\`, act on every item (update the canvas with canvas-set when the user asked for a change), answer each comment by writing {"replyTo","text"} to a file and running \`dolphin design reply --id ${design.id} --file <path> --json\`, and acknowledge with \`dolphin design ack --id ${design.id} --items <id,id> --json\`. Unacked items keep the notices coming.`
  ].join('\n')
}
