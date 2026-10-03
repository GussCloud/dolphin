import { afterEach, describe, expect, it, vi } from 'vitest'

const { listRegisteredPtysMock } = vi.hoisted(() => ({ listRegisteredPtysMock: vi.fn() }))
vi.mock('../memory/pty-registry', () => ({ listRegisteredPtys: listRegisteredPtysMock }))

import { PROCESS_HEAP_HEARTBEAT_INTERVAL_MS } from './process-heap-heartbeat'
import { startRuntimeHostHeapHeartbeat } from './runtime-host-heap-heartbeat'

afterEach(() => {
  vi.useRealTimers()
})

describe('startRuntimeHostHeapHeartbeat', () => {
  it('reports this process heap with the tracked local PTY count', () => {
    vi.useFakeTimers()
    listRegisteredPtysMock.mockReturnValue([{ ptyId: 'a' }, { ptyId: 'b' }])
    const emit = vi.fn()
    const stop = startRuntimeHostHeapHeartbeat(emit)

    vi.advanceTimersByTime(PROCESS_HEAP_HEARTBEAT_INTERVAL_MS)
    stop()

    expect(emit).toHaveBeenCalledTimes(1)
    expect(emit.mock.calls[0][0]).toMatchObject({ sessionCount: 2 })
    expect(emit.mock.calls[0][0].heapUsedMb).toBeGreaterThan(0)
  })
})
