import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createClaudeDevChannelsDialogTracker } from './claude-dev-channels-dialog'
import { createDraftPasteReadyScanner } from './draft-paste-ready-scanner'

const FIXTURES = join(__dirname, '..', 'main', 'runtime', '__fixtures__')
const dialog = readFileSync(join(FIXTURES, 'claude-dev-channels-dialog.txt'), 'utf8')
const confirmed = readFileSync(join(FIXTURES, 'claude-dev-channels-confirmed.txt'), 'utf8')

function chunks(text: string, size: number): string[] {
  const out: string[] = []
  for (let index = 0; index < text.length; index += size) {
    out.push(text.slice(index, index + size))
  }
  return out
}

describe('createClaudeDevChannelsDialogTracker', () => {
  it('holds while the captured dialog owns the screen, whatever the chunking', () => {
    for (const size of [1, 7, 64, dialog.length]) {
      const tracker = createClaudeDevChannelsDialogTracker()
      const states = chunks(dialog, size).map((chunk) => tracker.observe(chunk))
      expect(states.at(-1)).toBe(true)
    }
  })

  it('releases once the confirmed session enters its main screen', () => {
    for (const size of [5, 64]) {
      const tracker = createClaudeDevChannelsDialogTracker()
      const states = chunks(confirmed, size).map((chunk) => tracker.observe(chunk))
      expect(states).toContain(true)
      expect(states.at(-1)).toBe(false)
    }
    // One replayed buffer holding both: the later dismissal wins.
    expect(createClaudeDevChannelsDialogTracker().observe(confirmed)).toBe(false)
  })

  it('ignores a plain Claude launch', () => {
    const tracker = createClaudeDevChannelsDialogTracker()
    expect(tracker.observe('\x1b[?2004h\x1b]0;✳ Claude Code\x07\x1b[?1049h')).toBe(false)
  })
})

describe('draft paste readiness under the dialog', () => {
  it('never reports quiet-window readiness while the dialog is up', () => {
    const scanner = createDraftPasteReadyScanner('render-quiet-after-bracketed-paste')
    const results = chunks(dialog, 32).map((chunk) => scanner.observe(chunk))
    expect(results.at(-1)).toEqual({ ready: false, armQuietTimer: false, hold: true })
    expect(results.some((result) => result.ready)).toBe(false)
  })

  it('arms the quiet window again after the dialog is confirmed', () => {
    const scanner = createDraftPasteReadyScanner('render-quiet-after-bracketed-paste')
    const results = chunks(confirmed, 64).map((chunk) => scanner.observe(chunk))
    expect(results.some((result) => result.hold)).toBe(true)
    expect(results.at(-1)).toEqual({ ready: false, armQuietTimer: true })
  })
})
