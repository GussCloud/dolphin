import { afterEach, describe, expect, it } from 'vitest'
import { HeadlessEmulator } from './daemon/headless-emulator'
import {
  detectTerminalComposerDraft,
  hasTerminalComposerTypedDraft
} from '../shared/terminal-composer-draft'
import {
  readPtyUserComposingWaitMs,
  TERMINAL_USER_COMPOSING_QUIET_MS
} from './terminal-user-composing-guard'

// Claude Code's idle composer at 120x40, from a capture with
// config/scripts/capture-agent-pty-transcript.mjs (claude 2.1.x): frame rows around `❯\xa0`, and the
// hardware cursor parked at row 36, column 3. The ghost suggestion is the one an E2E stall saw
// ("5 tentativas e 15 minutos", reported as the pane's draft). Its cells are dimmed: the stall's
// undimmed after-cursor text was empty while the raw text held the suggestion.
const FRAME = '─'.repeat(120)
const SUGGESTION = '5 tentativas e 15 minutos'
const PTY = 'pty-ghost-suggestion-test'

function claudeIdleScreen(promptRow: string): string {
  return [
    '\x1b[2J\x1b[H',
    '\x1b[14;3H⏺ O fluxo do login está no canvas (versão 1).',
    `\x1b[35;1H\x1b[38;2;136;136;136m${FRAME}\x1b[39m`,
    `\x1b[36;1H\x1b[39m❯\xa0${promptRow}`,
    `\x1b[37;1H\x1b[38;2;136;136;136m${FRAME}\x1b[39m`,
    '\x1b[38;3H\x1b[38;2;153;153;153m⏵⏵ bypass permissions on (shift+tab to cycle)\x1b[39m'
  ].join('')
}

describe('composing guard against agent ghost suggestions', () => {
  const emulators: HeadlessEmulator[] = []

  afterEach(() => {
    for (const emulator of emulators.splice(0)) {
      emulator.dispose()
    }
  })

  async function screen(data: string, cols = 120, rows = 40): Promise<HeadlessEmulator> {
    const emulator = new HeadlessEmulator({ cols, rows })
    emulators.push(emulator)
    await emulator.write(data)
    return emulator
  }

  it('does not read a dimmed Claude suggestion in an empty prompt as a user draft', async () => {
    const emulator = await screen(
      `${claudeIdleScreen(`\x1b[2m${SUGGESTION}\x1b[22m`)}\x1b[40;1H\x1b[36;3H`
    )
    const context = emulator.getCursorLineContext()
    expect(hasTerminalComposerTypedDraft(context)).toBe(false)
    expect(readPtyUserComposingWaitMs(PTY, emulator)).toBeNull()
    // Why: terminal reads still lift the suggestion out of output as draft metadata (#16711).
    expect(detectTerminalComposerDraft(context)?.text).toBe(SUGGESTION)
  })

  it('still reads typed text as a draft, with the cursor after it or moved to its start', async () => {
    const typed = 'review the change'
    for (const cursor of [`\x1b[36;${3 + typed.length}H`, '\x1b[36;3H']) {
      const emulator = await screen(`${claudeIdleScreen(typed)}${cursor}`)
      expect(hasTerminalComposerTypedDraft(emulator.getCursorLineContext())).toBe(true)
      expect(readPtyUserComposingWaitMs(PTY, emulator)).toBe(TERMINAL_USER_COMPOSING_QUIET_MS)
    }
  })

  it('reads typed text followed by a dimmed suggestion as a draft', async () => {
    const emulator = await screen(
      `${claudeIdleScreen(`5 \x1b[2mtentativas e 15 minutos\x1b[22m`)}\x1b[36;5H`
    )
    expect(hasTerminalComposerTypedDraft(emulator.getCursorLineContext())).toBe(true)
  })

  it('treats a dimmed Codex suggestion the same way, stock placeholder or not', async () => {
    for (const ghost of ['Ask Codex to do anything', 'Summarize the recent commits']) {
      const emulator = await screen(
        [
          '\x1b[2J\x1b[H\x1b[1m›\x1b[22m \x1b7',
          `\x1b[2m${ghost}\x1b[22m`,
          '\r\n\r\n\x1b[2mgpt-5.6 · ~/repo\x1b[22m\x1b8'
        ].join(''),
        80,
        10
      )
      expect(hasTerminalComposerTypedDraft(emulator.getCursorLineContext())).toBe(false)
    }
    const typed = await screen(
      '\x1b[2J\x1b[H\x1b[1m›\x1b[22m fix it\x1b7\r\n\r\n\x1b[2mgpt-5.6 · ~/repo\x1b[22m\x1b8',
      80,
      10
    )
    expect(hasTerminalComposerTypedDraft(typed.getCursorLineContext())).toBe(true)
  })
})
