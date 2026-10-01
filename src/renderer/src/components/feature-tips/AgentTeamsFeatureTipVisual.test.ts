import { describe, expect, it } from 'vitest'
import { nextAgentTeamsDemoState, type AgentTeamsDemoPhase } from './AgentTeamsFeatureTipVisual'

describe('nextAgentTeamsDemoState', () => {
  it('types the prompt one character at a time before the lead answers', () => {
    expect(nextAgentTeamsDemoState({ phase: 'idle', chars: 0 }, 3)).toEqual({
      phase: 'typing',
      chars: 0
    })
    expect(nextAgentTeamsDemoState({ phase: 'typing', chars: 2 }, 3)).toEqual({
      phase: 'typing',
      chars: 3
    })
    expect(nextAgentTeamsDemoState({ phase: 'typing', chars: 3 }, 3)).toEqual({
      phase: 'planning',
      chars: 3
    })
  })

  it('splits in one teammate pane at a time, then loops back to an empty prompt', () => {
    const phases: AgentTeamsDemoPhase[] = []
    let state: { phase: AgentTeamsDemoPhase; chars: number } = { phase: 'planning', chars: 3 }
    while (state.phase !== 'idle') {
      state = nextAgentTeamsDemoState(state, 3)
      phases.push(state.phase)
    }

    expect(phases).toEqual(['firstTeammate', 'secondTeammate', 'working', 'done', 'idle'])
    expect(state.chars).toBe(0)
  })
})
