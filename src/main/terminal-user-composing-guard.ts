// Whether the user is mid-draft in an agent pane, so Dolphin must not type into it: an agent CLI
// reads idle while the user composes, and injected text plus Enter would submit their draft.
import { detectTerminalComposerDraft } from '../shared/terminal-composer-draft'
import type { HeadlessEmulator } from './daemon/headless-emulator'
import { readLatestTerminalInputAt } from './terminal-client-input-clock'

/** Keystrokes this recent mean the user is still writing. */
export const TERMINAL_USER_COMPOSING_QUIET_MS = 8_000

export type TerminalUserComposingEvidence = {
  /** `performance.now()` of the last user keystroke; undefined when never seen. */
  lastInputAt: number | undefined
  /** Text left in the agent's composer; undefined when no screen model exists. */
  hasComposerDraft: () => boolean | undefined
  now: number
}

/**
 * Milliseconds until injection may be retried, or null when the pane is free. A draft with no
 * recent keystroke waits one quiet window per check. Unknown evidence never blocks.
 */
export function readTerminalUserComposingWaitMs(
  evidence: TerminalUserComposingEvidence
): number | null {
  const sinceInput =
    evidence.lastInputAt === undefined ? Infinity : evidence.now - evidence.lastInputAt
  if (sinceInput < TERMINAL_USER_COMPOSING_QUIET_MS) {
    return TERMINAL_USER_COMPOSING_QUIET_MS - Math.max(sinceInput, 0)
  }
  return evidence.hasComposerDraft() === true ? TERMINAL_USER_COMPOSING_QUIET_MS : null
}

/** The guard for one PTY, reading the shared input clock and its headless screen model. */
export function readPtyUserComposingWaitMs(
  ptyId: string,
  emulator: HeadlessEmulator | undefined
): number | null {
  return readTerminalUserComposingWaitMs({
    lastInputAt: readLatestTerminalInputAt(ptyId),
    hasComposerDraft: () =>
      emulator ? detectTerminalComposerDraft(emulator.getCursorLineContext()) !== null : undefined,
    now: performance.now()
  })
}
