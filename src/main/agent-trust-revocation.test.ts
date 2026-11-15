import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { revokeWorktreeAgentTrust } from './agent-trust-revocation'

let home = ''
const removed = '/work/app-worktrees/feature'
const kept = '/work/app'

function json(path: string, value: unknown): void {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, JSON.stringify(value))
}

function read(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf-8'))
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'dolphin-trust-revoke-'))
})

afterEach(() => {
  rmSync(home, { recursive: true, force: true })
})

describe('revokeWorktreeAgentTrust', () => {
  it("drops the removed worktree's trust from every agent config and keeps everything else", async () => {
    const profile = join(home, 'profiles', 'work')
    json(join(home, '.claude.json'), {
      theme: 'dark',
      projects: { [removed]: { hasTrustDialogAccepted: true }, [kept]: { allowedTools: [] } }
    })
    json(join(profile, '.claude.json'), {
      projects: { [removed]: { hasTrustDialogAccepted: true } }
    })
    json(join(home, '.copilot', 'config.json'), { trustedFolders: [kept, removed], user: 'me' })
    json(join(home, '.gemini', 'antigravity-cli', 'settings.json'), {
      trustedWorkspaces: [removed],
      model: 'x'
    })
    const cursorDir = join(home, '.cursor', 'projects', 'work-app-worktrees-feature')
    json(join(cursorDir, '.workspace-trusted'), { workspacePath: removed })

    await revokeWorktreeAgentTrust(removed, {
      home,
      platform: 'linux',
      claudeProfileDirs: () => [profile]
    })

    expect(read(join(home, '.claude.json'))).toEqual({
      theme: 'dark',
      projects: { [kept]: { allowedTools: [] } }
    })
    expect(read(join(profile, '.claude.json'))).toEqual({ projects: {} })
    expect(read(join(home, '.copilot', 'config.json'))).toEqual({
      trustedFolders: [kept],
      user: 'me'
    })
    expect(read(join(home, '.gemini', 'antigravity-cli', 'settings.json'))).toEqual({
      trustedWorkspaces: [],
      model: 'x'
    })
    expect(existsSync(cursorDir)).toBe(false)
  })

  it('keeps a Cursor project folder that holds more than the trust marker', async () => {
    const cursorDir = join(home, '.cursor', 'projects', 'work-app-worktrees-feature')
    json(join(cursorDir, '.workspace-trusted'), {})
    writeFileSync(join(cursorDir, 'chat.json'), '{}')
    await revokeWorktreeAgentTrust(removed, {
      home,
      platform: 'linux',
      claudeProfileDirs: () => []
    })
    expect(existsSync(join(cursorDir, '.workspace-trusted'))).toBe(false)
    expect(existsSync(join(cursorDir, 'chat.json'))).toBe(true)
  })

  it('leaves malformed or missing configs untouched and never throws', async () => {
    mkdirSync(join(home, '.copilot'), { recursive: true })
    writeFileSync(join(home, '.copilot', 'config.json'), '{broken')
    await expect(
      revokeWorktreeAgentTrust(removed, { home, platform: 'linux', claudeProfileDirs: () => [] })
    ).resolves.toBeUndefined()
    expect(readFileSync(join(home, '.copilot', 'config.json'), 'utf-8')).toBe('{broken')
    expect(existsSync(join(home, '.claude.json'))).toBe(false)
  })
})
