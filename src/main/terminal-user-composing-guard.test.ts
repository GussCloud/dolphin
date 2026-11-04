import { describe, expect, it } from 'vitest'
import {
  readTerminalUserComposingWaitMs,
  TERMINAL_USER_COMPOSING_QUIET_MS
} from './terminal-user-composing-guard'

const noDraft = () => false

describe('terminal user composing guard', () => {
  it('blocks for the rest of the quiet window after a keystroke', () => {
    expect(
      readTerminalUserComposingWaitMs({ lastInputAt: 1_000, hasComposerDraft: noDraft, now: 3_000 })
    ).toBe(TERMINAL_USER_COMPOSING_QUIET_MS - 2_000)
  })

  it('frees the pane once the quiet window has passed with an empty composer', () => {
    expect(
      readTerminalUserComposingWaitMs({
        lastInputAt: 1_000,
        hasComposerDraft: noDraft,
        now: 1_000 + TERMINAL_USER_COMPOSING_QUIET_MS
      })
    ).toBeNull()
  })

  it('keeps blocking while a draft sits in the composer', () => {
    expect(
      readTerminalUserComposingWaitMs({
        lastInputAt: 0,
        hasComposerDraft: () => true,
        now: 10 * TERMINAL_USER_COMPOSING_QUIET_MS
      })
    ).toBe(TERMINAL_USER_COMPOSING_QUIET_MS)
  })

  it('never blocks on unknown evidence', () => {
    expect(
      readTerminalUserComposingWaitMs({
        lastInputAt: undefined,
        hasComposerDraft: () => undefined,
        now: 5
      })
    ).toBeNull()
  })
})
