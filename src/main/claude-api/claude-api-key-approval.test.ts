import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  claudeApiKeyApprovalSuffix,
  preapproveClaudeApiKeyInProfile
} from './claude-api-key-approval'

const FAKE_KEY = 'sk-ant-fake-0000-AAAAAAAAAAbbbbbbbbbb'

let dir: string | null = null
function profile(): string {
  dir = mkdtempSync(join(tmpdir(), 'claude-api-approval-'))
  return dir
}

afterEach(() => {
  if (dir) {
    rmSync(dir, { recursive: true, force: true })
  }
  dir = null
})

function readState(profileDir: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(profileDir, '.claude.json'), 'utf-8'))
}

describe('preapproveClaudeApiKeyInProfile', () => {
  it('stores only the last 20 characters, once, keeping the rest of the state', async () => {
    const profileDir = profile()
    writeFileSync(
      join(profileDir, '.claude.json'),
      JSON.stringify({ hasCompletedOnboarding: true })
    )
    await preapproveClaudeApiKeyInProfile(profileDir, FAKE_KEY)
    await preapproveClaudeApiKeyInProfile(profileDir, FAKE_KEY)
    const state = readState(profileDir)
    expect(state.hasCompletedOnboarding).toBe(true)
    expect(state.customApiKeyResponses).toEqual({
      approved: [claudeApiKeyApprovalSuffix(FAKE_KEY)],
      rejected: []
    })
    expect(claudeApiKeyApprovalSuffix(FAKE_KEY)).toHaveLength(20)
    expect(JSON.stringify(state)).not.toContain(FAKE_KEY)
  })

  it('moves a previously rejected key to approved', async () => {
    const profileDir = profile()
    const suffix = claudeApiKeyApprovalSuffix(FAKE_KEY)
    writeFileSync(
      join(profileDir, '.claude.json'),
      JSON.stringify({ customApiKeyResponses: { approved: ['old'], rejected: [suffix] } })
    )
    await preapproveClaudeApiKeyInProfile(profileDir, FAKE_KEY)
    expect(readState(profileDir).customApiKeyResponses).toEqual({
      approved: ['old', suffix],
      rejected: []
    })
  })
})
