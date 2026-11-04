import { describe, expect, it } from 'vitest'
import {
  AUTONOMOUS_GOAL_DEFAULT_CONTEXT_WINDOW_TOKENS,
  resolveCoordinatorContextWindow
} from './autonomous-goal-context-window'

describe('coordinator context window', () => {
  it('takes the window the transcript states first', () => {
    expect(
      resolveCoordinatorContextWindow({
        agent: 'codex',
        reading: { contextTokens: 1, windowTokens: 272_000 },
        sessionModel: 'claude-opus-5[1m]'
      })
    ).toBe(272_000)
  })

  it('reads 1M from a [1m] session model', () => {
    expect(
      resolveCoordinatorContextWindow({
        agent: 'claude-agent-teams',
        reading: { contextTokens: 1, responseModel: 'claude-opus-5' },
        sessionModel: 'claude-opus-5[1m]'
      })
    ).toBe(1_000_000)
  })

  it('follows a mid-session /model to another base model', () => {
    expect(
      resolveCoordinatorContextWindow({
        agent: 'claude',
        reading: { contextTokens: 1, responseModel: 'claude-sonnet-5' },
        sessionModel: 'claude-opus-5[1m]'
      })
    ).toBe(AUTONOMOUS_GOAL_DEFAULT_CONTEXT_WINDOW_TOKENS)
  })

  it('falls back to 200k for an unknown or bare model', () => {
    expect(
      resolveCoordinatorContextWindow({ agent: 'claude', reading: { contextTokens: 1 } })
    ).toBe(200_000)
    expect(
      resolveCoordinatorContextWindow({
        agent: 'claude',
        reading: { contextTokens: 1 },
        sessionModel: 'claude-opus-5'
      })
    ).toBe(200_000)
  })

  it("caps DeepSeek at its guide's window and ignores its API's response model", () => {
    expect(
      resolveCoordinatorContextWindow({
        agent: 'deepseek',
        reading: { contextTokens: 1, responseModel: 'deepseek-v4-flash' },
        sessionModel: 'deepseek-flash[1m]'
      })
    ).toBe(786_432)
    expect(
      resolveCoordinatorContextWindow({
        agent: 'deepseek-agent-teams',
        reading: { contextTokens: 1 }
      })
    ).toBe(786_432)
    expect(
      resolveCoordinatorContextWindow({
        agent: 'deepseek',
        reading: { contextTokens: 1 },
        sessionModel: 'deepseek-flash'
      })
    ).toBe(200_000)
  })
})
