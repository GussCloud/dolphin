import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CLAUDE_PROFILE_MARKER } from '../pinned-config-dir/claude-pinned-config-layout'
import {
  isClaudeApiProfilePath,
  listClaudeApiProfileConfigDirs,
  listClaudeApiProfileProjectsDirs,
  listClaudePlanProfileConfigDirs,
  listClaudePlanProfileProjectsDirs,
  listClaudeProfileConfigDirs,
  listClaudeProfileProjectsDirs,
  registerClaudeProfileRootSources
} from './claude-profile-roots'

const state = { userData: '' }

describe('listClaudeProfileConfigDirs', () => {
  beforeEach(() => {
    state.userData = mkdtempSync(join(tmpdir(), 'dolphin-profile-roots-'))
    registerClaudeProfileRootSources({
      managedAccountsRoot: () => join(state.userData, 'claude-accounts'),
      linkedConfigDirs: () => ['/linked/.claude-empresa'],
      apiKeyAccountIds: () => ['api']
    })
  })

  afterEach(() => {
    rmSync(state.userData, { recursive: true, force: true })
  })

  it('lists only dirs this layout prepared as profiles', () => {
    const root = join(state.userData, 'claude-accounts')
    mkdirSync(join(root, 'work', 'config'), { recursive: true })
    writeFileSync(join(root, 'work', 'config', CLAUDE_PROFILE_MARKER), '{"version":1}\n')
    mkdirSync(join(root, 'never-launched', 'auth'), { recursive: true })

    expect(listClaudeProfileConfigDirs()).toEqual([
      join(root, 'work', 'config'),
      '/linked/.claude-empresa'
    ])
    expect(listClaudeProfileProjectsDirs()).toEqual([
      join(root, 'work', 'config', 'projects'),
      join('/linked/.claude-empresa', 'projects')
    ])
  })

  it('lists only linked folders before any isolated profile exists', () => {
    expect(listClaudeProfileConfigDirs()).toEqual(['/linked/.claude-empresa'])
  })

  it('splits API account profiles from the plan profiles, so a transcript has one owner', () => {
    const root = join(state.userData, 'claude-accounts')
    for (const id of ['work', 'api']) {
      mkdirSync(join(root, id, 'config'), { recursive: true })
      writeFileSync(join(root, id, 'config', CLAUDE_PROFILE_MARKER), '{"version":1}\n')
    }

    expect(listClaudeProfileConfigDirs().sort()).toEqual(
      [join(root, 'api', 'config'), join(root, 'work', 'config'), '/linked/.claude-empresa'].sort()
    )
    expect(listClaudePlanProfileConfigDirs()).toEqual([
      join(root, 'work', 'config'),
      '/linked/.claude-empresa'
    ])
    expect(listClaudePlanProfileProjectsDirs()).not.toContain(
      join(root, 'api', 'config', 'projects')
    )
    expect(listClaudeApiProfileConfigDirs()).toEqual([join(root, 'api', 'config')])
    expect(listClaudeApiProfileProjectsDirs()).toEqual([join(root, 'api', 'config', 'projects')])
  })
})

describe('isClaudeApiProfilePath', () => {
  const root = join(tmpdir(), 'dolphin-api-path', 'claude-accounts')

  beforeEach(() => {
    registerClaudeProfileRootSources({
      managedAccountsRoot: () => root,
      linkedConfigDirs: () => [],
      apiKeyAccountIds: () => ['api']
    })
  })

  it('accepts a transcript under an API account profile only', () => {
    expect(isClaudeApiProfilePath(join(root, 'api', 'config', 'projects', 'b', 's.jsonl'))).toBe(
      true
    )
    expect(isClaudeApiProfilePath(join(root, 'work', 'config', 'projects', 'b', 's.jsonl'))).toBe(
      false
    )
    expect(isClaudeApiProfilePath(join(root, 'api', 'auth', 's.jsonl'))).toBe(false)
    expect(isClaudeApiProfilePath(join(root, 'api', 'config'))).toBe(false)
    expect(isClaudeApiProfilePath(join(root, 'api', 'config', '..', '..', 'x.jsonl'))).toBe(false)
    expect(isClaudeApiProfilePath('api/config/projects/s.jsonl')).toBe(false)
    expect(isClaudeApiProfilePath(undefined)).toBe(false)
  })

  it('claims nothing before the account service registers its sources', () => {
    registerClaudeProfileRootSources({
      managedAccountsRoot: () => null,
      linkedConfigDirs: () => [],
      apiKeyAccountIds: () => ['api']
    })
    expect(isClaudeApiProfilePath(join(root, 'api', 'config', 'projects', 's.jsonl'))).toBe(false)
  })
})
