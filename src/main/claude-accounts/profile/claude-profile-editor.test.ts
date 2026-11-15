import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CLAUDE_PROFILE_MARKER } from '../pinned-config-dir/claude-pinned-config-layout'
import {
  describeClaudeProfile,
  importIntoClaudeProfileTarget,
  markClaudeProfileReviewed,
  saveClaudeProfileInstructions,
  type ClaudeProfileTarget
} from './claude-profile-editor'

let root = ''
let target: ClaudeProfileTarget

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'dolphin-profile-editor-'))
  const userConfigDir = join(root, 'home', '.claude')
  mkdirSync(userConfigDir, { recursive: true })
  writeFileSync(join(userConfigDir, 'CLAUDE.md'), '# personal\n')
  target = {
    accountId: 'work',
    configDir: join(root, 'userData', 'claude-accounts', 'work', 'config'),
    linked: false,
    userConfigDir,
    userStatePath: join(root, 'home', '.claude.json')
  }
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('account profile screen', () => {
  it('describes a profile that never launched, isolating it first', async () => {
    const details = await describeClaudeProfile(target)
    expect(details).toMatchObject({ linked: false, reviewPending: false, instructions: null })
    expect(details.importItems.map((entry) => entry.id)).toEqual(['instructions:CLAUDE.md'])
    expect(existsSync(join(target.configDir, CLAUDE_PROFILE_MARKER))).toBe(true)
  })

  it('drops MCP servers the shared layout copied in, before the first launch can keep them', async () => {
    mkdirSync(target.configDir, { recursive: true })
    writeFileSync(
      join(target.configDir, '.claude.json'),
      JSON.stringify({ mcpServers: { vps: { command: 'ssh-mcp' } }, theme: 'dark' })
    )
    const details = await describeClaudeProfile(target)
    expect(details.mcpServers).toEqual([])
    expect(JSON.parse(readFileSync(join(target.configDir, '.claude.json'), 'utf-8'))).toEqual({
      theme: 'dark'
    })
  })

  it("saves the account's own instructions without touching the user's", async () => {
    await saveClaudeProfileInstructions(target, '# company\n')
    expect(readFileSync(join(target.configDir, 'CLAUDE.md'), 'utf-8')).toBe('# company\n')
    expect(readFileSync(join(target.userConfigDir, 'CLAUDE.md'), 'utf-8')).toBe('# personal\n')
  })

  it('clears the review notice of a converted profile', async () => {
    mkdirSync(target.configDir, { recursive: true })
    writeFileSync(
      join(target.configDir, CLAUDE_PROFILE_MARKER),
      JSON.stringify({ version: 1, copied: ['CLAUDE.md'], reviewPending: true })
    )
    expect(await describeClaudeProfile(target)).toMatchObject({
      reviewPending: true,
      migratedCopied: ['CLAUDE.md']
    })
    markClaudeProfileReviewed(target)
    expect((await describeClaudeProfile(target)).reviewPending).toBe(false)
  })

  it('edits a linked folder but never imports into it or isolates it', async () => {
    const linked = { ...target, linked: true, configDir: join(root, 'home', '.claude-empresa') }
    mkdirSync(linked.configDir, { recursive: true })
    const details = await describeClaudeProfile(linked)
    expect(details.importItems).toEqual([])
    expect(existsSync(join(linked.configDir, CLAUDE_PROFILE_MARKER))).toBe(false)
    await expect(importIntoClaudeProfileTarget(linked, ['instructions:CLAUDE.md'])).rejects.toThrow(
      'linked folder'
    )
  })
})
