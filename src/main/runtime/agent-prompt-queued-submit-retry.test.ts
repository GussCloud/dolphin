import { describe, expect, it, vi } from 'vitest'
import {
  retryUnstartedQueuedPromptSubmit,
  type AgentPromptActivity
} from './agent-prompt-submission-verification'

const idle: AgentPromptActivity = {
  generation: 1,
  permissionSequence: 0,
  workingSequence: 0,
  explicitWorkingStartedAt: null,
  outputSequence: 0,
  status: 'idle'
}

function run(activities: AgentPromptActivity[]) {
  const resubmit = vi.fn(() => true)
  const sleeps: number[] = []
  let read = 0
  const result = retryUnstartedQueuedPromptSubmit({
    baseline: idle,
    readActivity: () => activities[Math.min(read++, activities.length - 1)]!,
    resubmit,
    firstDelayMs: 3_000,
    sleep: async (ms) => {
      sleeps.push(ms)
    }
  })
  return { result, resubmit, sleeps }
}

describe('retryUnstartedQueuedPromptSubmit', () => {
  it('stops at the first turn start', async () => {
    const h = run([idle, { ...idle, workingSequence: 1, status: 'working' }])
    expect(await h.result).toBe(true)
    expect(h.resubmit).toHaveBeenCalledOnce()
    expect(h.sleeps).toEqual([3_000, 5_000])
  })

  it('counts a hook-reported turn start', async () => {
    const h = run([{ ...idle, explicitWorkingStartedAt: 10, status: 'working' }])
    expect(await h.result).toBe(true)
    expect(h.resubmit).not.toHaveBeenCalled()
  })

  it('never types into a permission prompt or a replaced process', async () => {
    expect(await run([{ ...idle, status: 'permission' }]).result).toBe(false)
    const replaced = run([{ ...idle, generation: 2 }])
    expect(await replaced.result).toBe(false)
    expect(replaced.resubmit).not.toHaveBeenCalled()
  })

  it('gives up after three Enters when no turn ever starts', async () => {
    const h = run([idle])
    expect(await h.result).toBe(false)
    expect(h.resubmit).toHaveBeenCalledTimes(3)
  })
})
