import type { RuntimeLeafRecord } from './runtime-terminal-state-records'
import { MAX_TERMINAL_PREVIEW_CHARS, MAX_TERMINAL_READ_LIMIT } from './terminal-tail-limits'

/** What an exited pane keeps for post-exit readers: the newest lines up to the
 *  char budget an un-cursored `terminal read` already returns, so that read is
 *  unchanged while the rest of the 256 KiB live tail is released. */
export const EXITED_TERMINAL_TAIL_CHARS = MAX_TERMINAL_PREVIEW_CHARS

export type ExitedTerminalTailRecord = Pick<
  RuntimeLeafRecord,
  | 'tailBuffer'
  | 'tailTranscriptBuffer'
  | 'tailTranscriptChars'
  | 'tailPartialLine'
  | 'tailRedrawCursor'
  | 'tailWaitState'
>

function newestLinesWithinBudget(
  lines: string[],
  charBudget: number
): { lines: string[]; characters: number } {
  let characters = 0
  let start = lines.length
  while (start > 0 && lines.length - start < MAX_TERMINAL_READ_LIMIT) {
    start -= 1
    characters += lines[start]!.length
    // Why inclusive of the crossing line: the read's char trim must still see
    // an over-budget tail, so it slices and flags `limited` exactly as before.
    if (characters >= charBudget) {
      break
    }
  }
  return { lines: start === 0 ? lines : lines.slice(start), characters }
}

/** Shrinks an exited pane's retained tail. Totals and the truncation flag stay
 *  untouched so cursor math is unchanged; laggard cursor reads see the moved
 *  oldestCursor as `truncated`, the same signal live overflow gives them. */
export function compactExitedTerminalTail(record: ExitedTerminalTailRecord): void {
  const previewBudget = Math.max(0, EXITED_TERMINAL_TAIL_CHARS - record.tailPartialLine.length)
  const tail = newestLinesWithinBudget(record.tailBuffer, previewBudget)
  const transcript = newestLinesWithinBudget(
    record.tailTranscriptBuffer,
    EXITED_TERMINAL_TAIL_CHARS
  )
  record.tailBuffer = tail.lines
  record.tailTranscriptBuffer = transcript.lines
  record.tailTranscriptChars = transcript.characters
  if (record.tailRedrawCursor && record.tailRedrawCursor.rowFromEnd > tail.lines.length) {
    record.tailRedrawCursor = null
  }
  // Why: the memoized wait scan describes the uncompacted tail.
  record.tailWaitState = undefined
}
