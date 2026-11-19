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
    '- After the canvas is accepted, reply with a short summary and end your turn: the user reviews it on the Design screen.'
  ].join('\n')
}
