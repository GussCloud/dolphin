// Captured (claude 2.1.294, see __fixtures__/claude-dev-channels-*.txt): with
// --dangerously-load-development-channels Claude enables bracketed paste, then paints a full-screen
// confirmation, and only enters the alternate screen with a `✳` title once it is confirmed. Text
// pasted while it is up is swallowed and its Enter confirms the dialog, so the prompt is lost.
const ESC = String.fromCharCode(27)
// Words are separated by spaces or cursor-forward (CSI n C) moves.
const GAP = `(?:\\s|${ESC}\\[\\d*C)+`
const DIALOG_RE = new RegExp(`Loading${GAP}development${GAP}channels`, 'g')
// Alternate screen entered, or the `✳` session title set.
const DISMISSED_RE = new RegExp(`${ESC}\\[\\?1049h|${ESC}\\]0;✳`, 'g')
const CARRY_CHARS = 128

function lastMatchIndex(text: string, pattern: RegExp): number {
  let last = -1
  pattern.lastIndex = 0
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    last = match.index
  }
  return last
}

/** Tracks whether Claude's development-channels confirmation currently owns the screen. */
export function createClaudeDevChannelsDialogTracker(): { observe: (data: string) => boolean } {
  let carry = ''
  let pending = false
  return {
    observe(data: string): boolean {
      const window = carry + data
      carry = window.slice(-CARRY_CHARS)
      const dialogAt = lastMatchIndex(window, DIALOG_RE)
      const dismissedAt = lastMatchIndex(window, DISMISSED_RE)
      if (dialogAt > dismissedAt) {
        pending = true
      } else if (dismissedAt !== -1) {
        pending = false
      }
      return pending
    }
  }
}

/** How long a pending paste waits on the dialog before giving up, instead of typing into it. */
export const CLAUDE_DEV_CHANNELS_DIALOG_MAX_HOLD_MS = 5 * 60_000
