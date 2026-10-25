import { describe, expect, it, vi } from 'vitest'
import {
  compactDispatchPromptForStatus,
  DOLPHIN_WORKER_BRIEF_LEAD_LINE
} from '../../../shared/dolphin-dispatch-status-prompt'
import { DolphinRuntimeService } from '../dolphin-runtime'
import { buildWorkerBriefPointer, getWorkerBriefStore } from './worker-brief-store'

const keepLine = (value: string, max: number) => value.slice(0, max)

describe('buildWorkerBriefPointer', () => {
  const pointer = buildWorkerBriefPointer({
    cli: 'dolphin',
    taskId: 'task_1',
    dispatchId: 'ctx_1',
    taskSpec: '\n  Fix the login\tbug\x1b[31m on Windows\nsecond line'
  })

  it('is one printable line naming the worker-brief command', () => {
    // oxlint-disable-next-line no-control-regex -- asserting the pointer types no control bytes.
    expect(pointer).not.toMatch(/[\x00-\x1f\x7f]/)
    expect(pointer).toContain('`dolphin orchestration worker-brief --dispatch ctx_1 --json`')
  })

  it('keeps the sidebar task label readable from the typed prompt', () => {
    const typed = `${DOLPHIN_WORKER_BRIEF_LEAD_LINE} ${pointer}`
    expect(compactDispatchPromptForStatus(typed, 200, keepLine)).toBe(
      'You are working inside Dolphin, a multi-agent IDE. Your task ID is: task_1 === TASK === Fix the login bug 31m on Windows'
    )
  })

  it('clips a long first task line', () => {
    const long = buildWorkerBriefPointer({
      cli: 'dolphin',
      taskId: 't',
      dispatchId: 'd',
      taskSpec: 'x'.repeat(500)
    })
    expect(long.length).toBeLessThan(400)
    expect(long.endsWith('...')).toBe(true)
  })
})

describe('getWorkerBriefStore', () => {
  it('keeps briefs per runtime and evicts the oldest past the cap', () => {
    const runtime = new DolphinRuntimeService()
    const store = getWorkerBriefStore(runtime)
    for (let i = 0; i < 201; i += 1) {
      store.hold(`ctx_${i}`, { brief: `b${i}`, paneKey: 'p', taskId: 't' })
    }
    expect(store.read('ctx_0')).toBeUndefined()
    expect(store.read('ctx_200')?.brief).toBe('b200')
    expect(getWorkerBriefStore(new DolphinRuntimeService()).read('ctx_200')).toBeUndefined()
  })
})

describe('WorkerBriefStore waits', () => {
  it('hands a brief held after the worker asked, and reports the fetch', async () => {
    const store = getWorkerBriefStore(new DolphinRuntimeService())
    const asked = store.waitForHold('ctx_1', 1_000)
    const fetched = store.waitForFetch('ctx_1', 1_000)
    store.hold('ctx_1', { brief: 'b', paneKey: 'p', taskId: 't' })
    await expect(asked).resolves.toMatchObject({ brief: 'b' })
    store.markFetched('ctx_1')
    await expect(fetched).resolves.toBe(true)
    await expect(store.waitForFetch('ctx_1', 0)).resolves.toBe(true)
  })

  it('gives up when nothing arrives in time', async () => {
    vi.useFakeTimers()
    try {
      const store = getWorkerBriefStore(new DolphinRuntimeService())
      const asked = store.waitForHold('ctx_2', 500)
      const fetched = store.waitForFetch('ctx_2', 500)
      await vi.advanceTimersByTimeAsync(500)
      await expect(asked).resolves.toBeUndefined()
      await expect(fetched).resolves.toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})
