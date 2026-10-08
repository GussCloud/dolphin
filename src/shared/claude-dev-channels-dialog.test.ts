import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  createClaudeDevChannelsDialogTracker,
  shouldExtendTimeoutForClaudeDevChannelsDialog
} from './claude-dev-channels-dialog'
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

const channelPty = { holdOnClaudeDevChannelsDialog: () => true }

describe('draft paste readiness under the dialog', () => {
  it('never reports quiet-window readiness while the dialog is up in a channel PTY', () => {
    const scanner = createDraftPasteReadyScanner('render-quiet-after-bracketed-paste', channelPty)
    const results = chunks(dialog, 32).map((chunk) => scanner.observe(chunk))
    expect(results.at(-1)).toEqual({ ready: false, armQuietTimer: false, hold: true })
    expect(results.some((result) => result.ready)).toBe(false)
    expect(scanner.isHolding()).toBe(true)
  })

  it('arms the quiet window again after the dialog is confirmed', () => {
    const scanner = createDraftPasteReadyScanner('render-quiet-after-bracketed-paste', channelPty)
    const results = chunks(confirmed, 64).map((chunk) => scanner.observe(chunk))
    expect(results.some((result) => result.hold)).toBe(true)
    expect(results.at(-1)).toEqual({ ready: false, armQuietTimer: true })
    expect(scanner.isHolding()).toBe(false)
  })

  it('never holds without the per-PTY gate, so the phrase elsewhere is plain output', () => {
    for (const options of [undefined, { holdOnClaudeDevChannelsDialog: () => false }]) {
      const scanner = createDraftPasteReadyScanner('render-quiet-after-bracketed-paste', options)
      const results = chunks(dialog, 32).map((chunk) => scanner.observe(chunk))
      expect(results.some((result) => result.hold)).toBe(false)
      expect(results.at(-1)).toEqual({ ready: false, armQuietTimer: true })
      expect(scanner.isHolding()).toBe(false)
    }
  })

  it('holds while the per-PTY answer is still unknown', () => {
    const scanner = createDraftPasteReadyScanner('render-quiet-after-bracketed-paste', {
      holdOnClaudeDevChannelsDialog: () => 'unknown'
    })
    chunks(dialog, 32).forEach((chunk) => scanner.observe(chunk))
    expect(scanner.isHolding()).toBe(true)
  })

  it('still delivers a one-shot ready marker seen behind the dialog once it is dismissed', () => {
    const esc = String.fromCharCode(27)
    const scanner = createDraftPasteReadyScanner('render-cursor-after-bracketed-paste', channelPty)
    expect(scanner.observe(`${esc}[?2004h${dialog}${esc}[?25h`)).toEqual({
      ready: false,
      armQuietTimer: false,
      hold: true
    })
    expect(scanner.observe(`${esc}]0;✳ Claude Code${String.fromCharCode(7)}`)).toEqual({
      ready: true,
      armQuietTimer: false
    })
  })
})

describe('shouldExtendTimeoutForClaudeDevChannelsDialog', () => {
  it('extends only while holding and within five minutes', () => {
    expect(shouldExtendTimeoutForClaudeDevChannelsDialog(true, 0, 299_999)).toBe(true)
    expect(shouldExtendTimeoutForClaudeDevChannelsDialog(true, 0, 300_000)).toBe(false)
    expect(shouldExtendTimeoutForClaudeDevChannelsDialog(false, 0, 1)).toBe(false)
  })
})
