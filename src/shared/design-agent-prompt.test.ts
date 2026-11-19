import { describe, expect, it } from 'vitest'
import { buildDesignAgentInstructions, buildDesignStatusNotice } from './design-agent-prompt'

const DESIGN = { id: 'd1', name: 'Progress', request: 'Show progress', status: 'draft' as const }
const RULE = 'dolphin design revise-decision --id d1 --file <path> --json'

describe('design agent prompt', () => {
  it('tells a planning agent to revise an answered decision a later request changed', () => {
    const instructions = buildDesignAgentInstructions(DESIGN)
    expect(instructions).toContain(RULE)
    expect(instructions).toContain('{"decisionId","text"}')
  })

  it('repeats the rule in the implementation notice', () => {
    expect(buildDesignStatusNotice(DESIGN, 'in-progress', 2)).toContain(RULE)
  })
})
