import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startRelayHeapHeartbeat } from './relay-heap-heartbeat'

describe('startRelayHeapHeartbeat', () => {
  let stderrWrite: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    stderrWrite.mockRestore()
    vi.useRealTimers()
  })

  it('logs a heap line with the PTY count to relay.log and stops on demand', () => {
    const stop = startRelayHeapHeartbeat(() => 3, 1000)

    vi.advanceTimersByTime(1000)
    expect(stderrWrite).toHaveBeenCalledTimes(1)
    const line = String(stderrWrite.mock.calls[0][0])
    expect(line).toMatch(/^\S+ \[relay\] heap-heartbeat \{.*\}\n$/)
    const fields = JSON.parse(line.slice(line.indexOf('{')))
    expect(fields.sessionCount).toBe(3)
    expect(typeof fields.rssMb).toBe('number')

    stop()
    vi.advanceTimersByTime(5000)
    expect(stderrWrite).toHaveBeenCalledTimes(1)
  })

  it('does not keep the relay process alive', () => {
    vi.useRealTimers()
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    const stop = startRelayHeapHeartbeat(() => 0)
    const timer = setIntervalSpy.mock.results[0]?.value
    setIntervalSpy.mockRestore()
    try {
      expect(timer?.hasRef()).toBe(false)
    } finally {
      stop()
    }
  })
})
