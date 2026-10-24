import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { seedDeepSeekClaudeOnboarding } from './deepseek-claude-onboarding-seed'

const tempDirs: string[] = []

function makeConfigDir(): string {
  const root = mkdtempSync(join(tmpdir(), 'deepseek-home-'))
  tempDirs.push(root)
  return join(root, '.claude-deepseek')
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('seedDeepSeekClaudeOnboarding', () => {
  it('creates the config dir and marks onboarding done', () => {
    const configDir = makeConfigDir()
    seedDeepSeekClaudeOnboarding(configDir)
    expect(JSON.parse(readFileSync(join(configDir, '.claude.json'), 'utf8'))).toEqual({
      hasCompletedOnboarding: true
    })
  })

  it('never touches an existing file, even one without the flag', () => {
    const configDir = makeConfigDir()
    seedDeepSeekClaudeOnboarding(configDir)
    for (const existing of ['{"userID":"u1"}', '{ not json']) {
      writeFileSync(join(configDir, '.claude.json'), existing)
      seedDeepSeekClaudeOnboarding(configDir)
      expect(readFileSync(join(configDir, '.claude.json'), 'utf8')).toBe(existing)
    }
  })
})
