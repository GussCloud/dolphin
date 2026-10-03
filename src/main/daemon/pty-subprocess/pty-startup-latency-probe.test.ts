import { afterEach, describe, expect, it, vi } from 'vitest'
import { observePtyStartupLatency, type PtyStartupLatency } from './pty-startup-latency-probe'

function createFakePty() {
  let listener: ((data: string) => void) | null = null
  const written: string[] = []
  const proc = {
    onData(cb: (data: string) => void) {
      listener = cb
      return {
        dispose() {
          listener = null
        }
      }
    },
    write(data: string | Buffer) {
      written.push(String(data))
    }
  }
  return { proc, written, emit: (data: string) => listener?.(data), hasListener: () => !!listener }
}

describe('observePtyStartupLatency', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('reports how long the DA1 query waited for its reply and when output resumed', () => {
    const { proc, written, emit, hasListener } = createFakePty()
    const reports: PtyStartupLatency[] = []
    let clock = 0
    observePtyStartupLatency(
      proc,
      (latency) => reports.push(latency),
      () => clock
    )

    clock = 50
    emit('\x1b[c\x1b[?1004h')
    clock = 70
    proc.write('\x1b[?61;4c')
    clock = 330
    emit('PS C:\\> ')

    expect(written).toEqual(['\x1b[?61;4c'])
    expect(reports).toEqual([
      { firstOutputMs: 50, da1QueryMs: 50, da1ReplyMs: 70, firstOutputAfterDa1ReplyMs: 330 }
    ])
    expect(hasListener()).toBe(false)
  })

  it('reports an unanswered query when the window closes', () => {
    vi.useFakeTimers()
    const { proc, emit } = createFakePty()
    const reports: PtyStartupLatency[] = []
    observePtyStartupLatency(
      proc,
      (latency) => reports.push(latency),
      () => 0
    )

    emit('\x1b[c')
    vi.advanceTimersByTime(15_000)

    expect(reports).toEqual([{ firstOutputMs: 0, da1QueryMs: 0 }])
  })

  it('restores the original write once it reports', () => {
    const { proc, emit } = createFakePty()
    const originalWrite = proc.write
    observePtyStartupLatency(
      proc,
      () => {},
      () => 0
    )

    emit('\x1b[c')
    proc.write('\x1b[?1;2c')
    emit('prompt')

    expect(proc.write).toBe(originalWrite)
  })
})
