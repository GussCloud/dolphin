import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CLAUDE_PROFILE_MARKER } from '../pinned-config-dir/claude-pinned-config-layout'
import { listClaudeProfileConfigDirs, listClaudeProfileProjectsDirs } from './claude-profile-roots'

const state = { userData: '' }
vi.mock('electron', () => ({ app: { getPath: () => state.userData } }))

describe('listClaudeProfileConfigDirs', () => {
  beforeEach(() => {
    state.userData = mkdtempSync(join(tmpdir(), 'dolphin-profile-roots-'))
  })

  afterEach(() => {
    rmSync(state.userData, { recursive: true, force: true })
  })

  it('lists only dirs this layout prepared as profiles', () => {
    const root = join(state.userData, 'claude-accounts')
    mkdirSync(join(root, 'work', 'config'), { recursive: true })
    writeFileSync(join(root, 'work', 'config', CLAUDE_PROFILE_MARKER), '{"version":1}\n')
    mkdirSync(join(root, 'never-launched', 'auth'), { recursive: true })

    expect(listClaudeProfileConfigDirs()).toEqual([join(root, 'work', 'config')])
    expect(listClaudeProfileProjectsDirs()).toEqual([join(root, 'work', 'config', 'projects')])
  })

  it('is empty before any account exists', () => {
    expect(listClaudeProfileConfigDirs()).toEqual([])
  })
})
