import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { stripAnsiEscapeSequences } from '../../shared/ansi-escape-sequences'
import {
  claudeApiKeyApprovalSuffix,
  preapproveClaudeApiKeyInProfile
} from './claude-api-key-approval'

const FAKE_KEY = 'sk-ant-fake-0000-AAAAAAAAAAbbbbbbbbbb'
const NEW_KEY = 'sk-ant-fake-1111-CCCCCCCCCCdddddddddd'
const FIXTURES = join(__dirname, '..', 'runtime', '__fixtures__')

const ESC = String.fromCharCode(27)
// Why: Claude Code places each word with a cursor-column jump, so the jump reads as a space.
const CURSOR_COLUMN_JUMP = new RegExp(`${ESC}\\[\\d+G`, 'g')

/** The visible text of a captured PTY transcript. */
function screenText(name: string): string {
  const raw = readFileSync(join(FIXTURES, name), 'utf-8').replace(CURSOR_COLUMN_JUMP, ' ')
  return stripAnsiEscapeSequences(raw).replace(/[ \t]+/g, ' ')
}

let dir: string | null = null
function profile(state: unknown = {}): string {
  dir = mkdtempSync(join(tmpdir(), 'claude-api-approval-'))
  writeFileSync(join(dir, '.claude.json'), JSON.stringify(state))
  return dir
}

afterEach(() => {
  if (dir) {
    rmSync(dir, { recursive: true, force: true })
  }
  dir = null
})

function responses(profileDir: string): unknown {
  return JSON.parse(readFileSync(join(profileDir, '.claude.json'), 'utf-8')).customApiKeyResponses
}

describe('the captured Claude Code API key dialog', () => {
  it('asks with No as the default and shows the 20-character suffix the approval stores', () => {
    const text = screenText('claude-api-key-detected-prompt.txt')
    expect(text).toContain('Detected a custom API key in your environment')
    expect(text).toContain('Do you want to use this API key?')
    expect(text).toMatch(/❯ No \(recommended\)/)
    const shown = /ANTHROPIC_API_KEY: sk-ant-\.\.\.(\S+)/.exec(text)?.[1]
    expect(shown).toHaveLength(claudeApiKeyApprovalSuffix(FAKE_KEY).length)
  })

  it('does not appear once the suffix is pre-approved', () => {
    const text = screenText('claude-api-key-preapproved-ready.txt')
    expect(text).not.toContain('Detected a custom API key')
    expect(text).toContain('API Usage Billing')
  })
})

describe('preapproveClaudeApiKeyInProfile', () => {
  it('writes exactly what answering Yes writes, once, keeping the rest of the state', async () => {
    const profileDir = profile({ hasCompletedOnboarding: true })
    await preapproveClaudeApiKeyInProfile(profileDir, FAKE_KEY)
    await preapproveClaudeApiKeyInProfile(profileDir, FAKE_KEY)
    const state = JSON.parse(readFileSync(join(profileDir, '.claude.json'), 'utf-8'))
    expect(state.hasCompletedOnboarding).toBe(true)
    expect(state.customApiKeyResponses).toEqual({ approved: [FAKE_KEY.slice(-20)], rejected: [] })
    expect(JSON.stringify(state)).not.toContain(FAKE_KEY)
  })

  it('moves a previously rejected key to approved', async () => {
    const suffix = FAKE_KEY.slice(-20)
    const profileDir = profile({
      customApiKeyResponses: { approved: ['other'], rejected: [suffix, 'kept'] }
    })
    await preapproveClaudeApiKeyInProfile(profileDir, FAKE_KEY)
    expect(responses(profileDir)).toEqual({ approved: ['other', suffix], rejected: ['kept'] })
  })

  it('drops the replaced key when a new one is saved', async () => {
    const profileDir = profile({ customApiKeyResponses: { approved: [FAKE_KEY.slice(-20)] } })
    await preapproveClaudeApiKeyInProfile(profileDir, NEW_KEY, FAKE_KEY)
    expect(responses(profileDir)).toEqual({ approved: [NEW_KEY.slice(-20)], rejected: [] })
  })
})
