import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AGENT_PROMPT_STALLED_ERROR,
  verifyAgentPromptSubmissionWithRetry,
  type AgentPromptActivity
} from './agent-prompt-submission-verification'

const baseline: AgentPromptActivity = {
  generation: 1,
  permissionSequence: 0,
  workingSequence: 0,
  explicitWorkingStartedAt: null,
  outputSequence: 0,
  status: 'idle'
}

/** Activity that turns into a started turn at `turnStartsAt` ms (never when undefined). */
function activity(turnStartsAt: number | undefined, extra: Partial<AgentPromptActivity> = {}) {
  const startedAt = Date.now()
  return (): AgentPromptActivity =>
    turnStartsAt !== undefined && Date.now() - startedAt >= turnStartsAt
      ? { ...baseline, ...extra, workingSequence: 1, status: 'working' }
      : { ...baseline, ...extra }
}

describe('verifyAgentPromptSubmissionWithRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  async function run(options: {
    turnStartsAt: number | undefined
    retryAfterMs: number | undefined
    resubmit: () => boolean
    readActivity?: () => AgentPromptActivity
  }): Promise<unknown> {
    const verified = verifyAgentPromptSubmissionWithRetry({
      baseline,
      readActivity: options.readActivity ?? activity(options.turnStartsAt),
      allowOutputEvidence: false,
      timeoutMs: 10_000,
      retryAfterMs: options.retryAfterMs,
      resubmit: options.resubmit
    }).then(
      () => 'started',
      (error: Error) => error.message
    )
    await vi.runAllTimersAsync()
    return verified
  }

  it('sends no extra Enter when the first one started the turn', async () => {
    const resubmit = vi.fn(() => true)
    expect(await run({ turnStartsAt: 1_000, retryAfterMs: 3_000, resubmit })).toBe('started')
    expect(resubmit).not.toHaveBeenCalled()
  })

  it('re-sends Enter once when the first one was dropped, then sees the turn start', async () => {
    let resentAt: number | undefined
    const startedAt = Date.now()
    const resubmit = vi.fn(() => {
      resentAt = Date.now() - startedAt
      return true
    })
    // Why: the turn only starts after the retry, as when the composer dropped the first Enter.
    const readActivity = (): AgentPromptActivity =>
      resentAt !== undefined && Date.now() - startedAt >= resentAt + 200
        ? { ...baseline, workingSequence: 1, status: 'working' }
        : baseline
    expect(
      await run({ turnStartsAt: undefined, retryAfterMs: 3_000, resubmit, readActivity })
    ).toBe('started')
    expect(resubmit).toHaveBeenCalledTimes(1)
    expect(resentAt).toBeGreaterThanOrEqual(3_000)
  })

  it('retries at most once and keeps the overall deadline', async () => {
    const resubmit = vi.fn(() => true)
    const startedAt = Date.now()
    expect(await run({ turnStartsAt: undefined, retryAfterMs: 3_000, resubmit })).toBe(
      AGENT_PROMPT_STALLED_ERROR
    )
    expect(resubmit).toHaveBeenCalledTimes(1)
    expect(Date.now() - startedAt).toBeLessThan(10_200)
  })

  it('reports the stall unchanged when the retry is refused', async () => {
    const resubmit = vi.fn(() => false)
    expect(await run({ turnStartsAt: undefined, retryAfterMs: 3_000, resubmit })).toBe(
      AGENT_PROMPT_STALLED_ERROR
    )
    expect(resubmit).toHaveBeenCalledTimes(1)
  })

  it('never retries into a permission prompt', async () => {
    const resubmit = vi.fn(() => true)
    const readActivity = activity(undefined, { status: 'permission', permissionSequence: 1 })
    expect(
      await run({ turnStartsAt: undefined, retryAfterMs: 3_000, resubmit, readActivity })
    ).toBe('agent_prompt_blocked')
    expect(resubmit).not.toHaveBeenCalled()
  })

  it('leaves agents without a retry setting on the single Enter', async () => {
    const resubmit = vi.fn(() => true)
    expect(await run({ turnStartsAt: undefined, retryAfterMs: undefined, resubmit })).toBe(
      AGENT_PROMPT_STALLED_ERROR
    )
    expect(resubmit).not.toHaveBeenCalled()
  })
})
