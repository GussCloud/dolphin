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
export function createClaudeDevChannelsDialogTracker(): {
  observe: (data: string) => boolean
  pending: () => boolean
} {
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
    },
    pending: () => pending
  }
}

const AUTO_CONFIRM_WINDOW_CHARS = 8_192
// Why so literal: Enter is pressed for the user only on this exact screen, option 1 highlighted.
const AUTO_CONFIRM_SCREEN_RE =
  /WARNING: Loading development channels\n[\s\S]*?\nChannels: ([^\n]+)\n❯ 1\. I am using this for local development\n *2\. Exit\nEnter to confirm/

/** The dialog as painted lines: cursor moves become spaces or line breaks, other escapes vanish. */
function paintedLines(raw: string): string {
  return raw
    .replace(new RegExp(`${ESC}\\[\\d*C`, 'g'), ' ')
    .replace(new RegExp(`${ESC}\\[\\d+;\\d+H`, 'g'), '\n')
    .replace(new RegExp(`${ESC}\\][^\\u0007${ESC}]*(?:\\u0007|${ESC}\\\\)`, 'g'), '')
    .replace(new RegExp(`${ESC}\\[[0-9;?<>=]*[A-Za-z~]`, 'g'), '')
}

/**
 * Answers Claude's development-channels confirmation with Enter, once, and only when every listed
 * channel is one of `allowedServers` (Dolphin's own). Captured screens:
 * src/main/runtime/__fixtures__/claude-dev-channels-{dialog,two-servers}.txt.
 */
export function createClaudeDevChannelsAutoConfirm(allowedServers: readonly string[]): {
  /** True exactly once: when this chunk completes the recognized dialog. */
  observe: (data: string) => boolean
  /** Confirmed, dismissed by other means, or given up; the caller can stop feeding output. */
  done: () => boolean
} {
  const allowed = new Set(allowedServers.map((name) => `server:${name}`))
  let window = ''
  let finished = false
  return {
    observe(data: string): boolean {
      if (finished) {
        return false
      }
      window = (window + data).slice(-AUTO_CONFIRM_WINDOW_CHARS)
      const match = AUTO_CONFIRM_SCREEN_RE.exec(paintedLines(window))
      if (!match) {
        // Why stop: once the session is up, the dialog cannot appear again in this spawn.
        if (lastMatchIndex(window, DISMISSED_RE) !== -1) {
          finished = true
        }
        return false
      }
      finished = true
      const listed = match[1].split(', ').map((entry) => entry.trim())
      return listed.length > 0 && listed.every((entry) => allowed.has(entry))
    },
    done: () => finished
  }
}

/** How long a pending paste waits on the dialog before giving up, instead of typing into it. */
export const CLAUDE_DEV_CHANNELS_DIALOG_MAX_HOLD_MS = 5 * 60_000

/** Whether a hard timeout should wait longer instead of pasting blind into the dialog. */
export function shouldExtendTimeoutForClaudeDevChannelsDialog(
  isHolding: boolean,
  startedAt: number,
  now: number
): boolean {
  return isHolding && now - startedAt < CLAUDE_DEV_CHANNELS_DIALOG_MAX_HOLD_MS
}
