import { describe, expect, it } from 'vitest'
import { DolphinRuntimeService } from './dolphin-runtime'
import {
  compactExitedTerminalTail,
  EXITED_TERMINAL_TAIL_CHARS,
  type ExitedTerminalTailRecord
} from './exited-terminal-tail-retention'
import { readTerminalTail } from './terminal-tail-read'
import { MAX_TAIL_CHARS, MAX_TERMINAL_READ_LIMIT } from './terminal-tail-limits'

function line(index: number, width = 100): string {
  return `line-${index}-`.padEnd(width, 'x')
}

function recordWith(lines: string[], partialLine = ''): ExitedTerminalTailRecord {
  return {
    tailBuffer: [...lines],
    tailTranscriptBuffer: [...lines],
    tailTranscriptChars: lines.reduce((sum, entry) => sum + entry.length, 0),
    tailPartialLine: partialLine,
    tailRedrawCursor: null,
    tailWaitState: { waitText: 'stale', signal: null, fromTail: true }
  }
}

function read(
  record: ExitedTerminalTailRecord,
  linesTotal: number,
  opts: { cursor?: number; limit?: number }
) {
  return readTerminalTail({
    handle: 'term_1',
    status: 'exited',
    previewLines: record.tailBuffer,
    completedLines: record.tailTranscriptBuffer,
    partialLine: record.tailPartialLine,
    completedLineCount: linesTotal,
    bufferTruncated: false,
    ...opts
  })
}

describe('compactExitedTerminalTail', () => {
  it('keeps the newest lines just past the preview char budget', () => {
    const lines = Array.from({ length: 2000 }, (_, index) => line(index))
    const record = recordWith(lines)

    compactExitedTerminalTail(record)

    const kept = record.tailBuffer.reduce((sum, entry) => sum + entry.length, 0)
    expect(kept).toBeGreaterThanOrEqual(EXITED_TERMINAL_TAIL_CHARS)
    expect(kept - record.tailBuffer[0]!.length).toBeLessThan(EXITED_TERMINAL_TAIL_CHARS)
    expect(record.tailBuffer.at(-1)).toBe(lines.at(-1))
    expect(record.tailTranscriptBuffer).toEqual(record.tailBuffer)
    expect(record.tailTranscriptChars).toBe(kept)
    expect(record.tailWaitState).toBeUndefined()
  })

  it('returns the same un-cursored read before and after compaction', () => {
    const lines = Array.from({ length: 2000 }, (_, index) => line(index))
    for (const limit of [undefined, 50, 500, MAX_TERMINAL_READ_LIMIT]) {
      for (const partial of ['', 'prompt> ']) {
        const record = recordWith(lines, partial)
        const before = read(record, lines.length, { limit })
        compactExitedTerminalTail(record)
        const after = read(record, lines.length, { limit })
        // Only the paging floor moves: released lines are no longer cursor-addressable.
        expect({ ...after, oldestCursor: before.oldestCursor }).toEqual(before)
        expect(Number(after.oldestCursor)).toBeGreaterThan(0)
      }
    }
  })

  it('leaves small tails untouched', () => {
    const lines = ['done', 'exit 0']
    const record = recordWith(lines)
    const buffer = record.tailBuffer

    compactExitedTerminalTail(record)

    expect(record.tailBuffer).toBe(buffer)
    expect(record.tailTranscriptChars).toBe(10)
  })

  it('reports a laggard cursor read as truncated instead of returning released lines', () => {
    const lines = Array.from({ length: 2000 }, (_, index) => line(index))
    const record = recordWith(lines)
    compactExitedTerminalTail(record)

    const result = read(record, lines.length, { cursor: 0 })

    expect(result.truncated).toBe(true)
    expect(Number(result.oldestCursor)).toBe(lines.length - record.tailTranscriptBuffer.length)
    expect(result.tail.at(-1)).toBe(lines.at(-1))
  })

  it('drops a redraw cursor that points above the retained rows', () => {
    const record = recordWith(Array.from({ length: 2000 }, (_, index) => line(index)))
    record.tailRedrawCursor = { rowFromEnd: 1500, column: 0 }

    compactExitedTerminalTail(record)

    expect(record.tailRedrawCursor).toBeNull()
  })
})

type LeafInternals = {
  leavesByPtyId: Map<string, ExitedTerminalTailRecord[]>
}

describe('onPtyExit exited-pane tail retention', () => {
  function runtimeWithLeaf(): DolphinRuntimeService {
    const runtime = new DolphinRuntimeService()
    runtime.attachWindow(1)
    runtime.syncWindowGraph(1, {
      tabs: [
        { tabId: 'tab-1', worktreeId: 'wt-1', title: 'Shell', activeLeafId: 'pane:1', layout: null }
      ],
      leaves: [
        {
          tabId: 'tab-1',
          worktreeId: 'wt-1',
          leafId: 'pane:1',
          paneRuntimeId: 1,
          ptyId: 'pty-1',
          paneTitle: null
        }
      ]
    })
    return runtime
  }

  function leafOf(runtime: DolphinRuntimeService): ExitedTerminalTailRecord {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test reads the runtime's private leaf index.
    const internals = runtime as unknown as LeafInternals
    return internals.leavesByPtyId.get('pty-1')![0]!
  }

  it('releases the exited pane tail but keeps its final output readable', async () => {
    const runtime = runtimeWithLeaf()
    const handle = runtime.preAllocateHandleForPty('pty-1')
    const output = Array.from({ length: 3000 }, (_, index) => `${line(index)}\n`).join('')
    runtime.onPtyData('pty-1', output, 100)
    expect(leafOf(runtime).tailTranscriptChars).toBeGreaterThan(MAX_TAIL_CHARS / 2)

    runtime.onPtyExit('pty-1', 0)

    const leaf = leafOf(runtime)
    expect(leaf.tailTranscriptChars).toBeLessThan(EXITED_TERMINAL_TAIL_CHARS + 200)
    const result = await runtime.readTerminal(handle)
    expect(result.tail.at(-1)).toBe(line(2999))
    expect(result.tail).toHaveLength(120)
  })
})
