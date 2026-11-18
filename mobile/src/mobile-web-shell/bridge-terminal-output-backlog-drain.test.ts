import { describe, expect, it } from 'vitest'
import { BridgeTerminalOutputBacklog } from './bridge-terminal-output-backlog'

const output = (chunk: string) => ({ type: 'data', streamId: 1, chunk })
const resized = (cols: number) => ({ type: 'resized', streamId: 1, cols, rows: 24 })

function createBacklog(): BridgeTerminalOutputBacklog {
  return new BridgeTerminalOutputBacklog({
    onAckSilence: () => {},
    timers: { set: () => 1, clear: () => {} }
  })
}

function dataChunk(frame: unknown): string | null {
  return frame && typeof frame === 'object' && 'chunk' in frame && typeof frame.chunk === 'string'
    ? frame.chunk
    : null
}

// Flattens delivered frames back to the held order: merged output chunks concatenate, others stay.
function flatten(frames: readonly unknown[]): unknown[] {
  const flat: unknown[] = []
  for (const frame of frames) {
    const chunk = dataChunk(frame)
    const previous = dataChunk(flat.at(-1))
    if (chunk !== null && previous !== null) {
      flat[flat.length - 1] = output(previous + chunk)
    } else {
      flat.push(frame)
    }
  }
  return flat
}

describe('terminal backlog draining', () => {
  it('preserves order when partial drains compact the queue before more input arrives', () => {
    const payloads = Array.from({ length: 10_000 }, (_, index) =>
      index % 37 === 0 ? resized(index + 1) : output(`${index}\u001b[0m\n`)
    )
    const backlog = createBacklog()
    const frames: unknown[] = []
    try {
      for (const payload of payloads.slice(0, 5_000)) {
        backlog.hold(payload)
      }
      while (backlog.pendingBytes > 50_000) {
        frames.push(backlog.next(640, true))
      }
      for (const payload of payloads.slice(5_000)) {
        backlog.hold(payload)
      }
      while (backlog.held) {
        frames.push(backlog.next(640, true))
      }
      expect(flatten(frames)).toEqual(flatten(payloads))
      expect(backlog.pendingBytes).toBe(0)
      expect(backlog.next(640, true)).toBeNull()

      backlog.hold(output('a'))
      backlog.hold(resized(2))
      backlog.hold(output('b'))
      expect(backlog.next(640, true)).toEqual(output('a'))
      backlog.dispose()
      backlog.hold(output('after reset'))
      expect(backlog.held).toBe(true)
      expect(backlog.next(640, true)).toEqual(output('after reset'))
    } finally {
      backlog.dispose()
    }
  })
})
