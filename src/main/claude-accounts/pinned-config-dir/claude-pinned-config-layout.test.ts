import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  linkSharedClaudeConfig,
  mergePinnedClaudeState,
  seedPinnedClaudeState
} from './claude-pinned-config-layout'

let root = ''
let userDir = ''
let pinnedDir = ''

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'dolphin-claude-pinned-'))
  userDir = join(root, 'home', '.claude')
  pinnedDir = join(root, 'userData', 'claude-accounts', 'acct', 'config')
  mkdirSync(userDir, { recursive: true })
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('linkSharedClaudeConfig', () => {
  it.skipIf(process.platform === 'win32')(
    'shares instructions, settings and session history with the user config dir',
    () => {
      writeFileSync(join(userDir, 'settings.json'), '{"statusLine":{}}\n')
      writeFileSync(join(userDir, 'CLAUDE.md'), '# rules\n')
      mkdirSync(join(userDir, 'projects', '-repo'), { recursive: true })
      writeFileSync(join(userDir, 'projects', '-repo', 's.jsonl'), '{}\n')

      linkSharedClaudeConfig(pinnedDir, userDir)

      expect(lstatSync(join(pinnedDir, 'settings.json')).isSymbolicLink()).toBe(true)
      expect(readFileSync(join(pinnedDir, 'CLAUDE.md'), 'utf-8')).toBe('# rules\n')
      expect(existsSync(join(pinnedDir, 'projects', '-repo', 's.jsonl'))).toBe(true)
      // A session written through the pinned dir lands in the user's history.
      writeFileSync(join(pinnedDir, 'projects', '-repo', 'new.jsonl'), '{}\n')
      expect(existsSync(join(userDir, 'projects', '-repo', 'new.jsonl'))).toBe(true)
      expect(realpathSync(join(pinnedDir, 'skills'))).toBe(realpathSync(join(userDir, 'skills')))
    }
  )

  it('never shares credentials or the per-account state file', () => {
    writeFileSync(join(userDir, '.credentials.json'), '{"user":true}\n')
    writeFileSync(join(userDir, '.claude.json'), '{}\n')

    linkSharedClaudeConfig(pinnedDir, userDir)

    expect(existsSync(join(pinnedDir, '.credentials.json'))).toBe(false)
    expect(existsSync(join(pinnedDir, '.claude.json'))).toBe(false)
  })

  it.skipIf(process.platform === 'win32')(
    're-links a file the CLI replaced only when nothing would be lost',
    () => {
      writeFileSync(join(userDir, 'settings.json'), '{"a":1}\n')
      writeFileSync(join(userDir, 'CLAUDE.md'), 'user\n')
      mkdirSync(pinnedDir, { recursive: true })
      writeFileSync(join(pinnedDir, 'settings.json'), '{"a":1}\n')
      writeFileSync(join(pinnedDir, 'CLAUDE.md'), 'pinned edit\n')

      const outcomes = linkSharedClaudeConfig(pinnedDir, userDir)

      expect(lstatSync(join(pinnedDir, 'settings.json')).isSymbolicLink()).toBe(true)
      expect(readFileSync(join(pinnedDir, 'CLAUDE.md'), 'utf-8')).toBe('pinned edit\n')
      expect(outcomes).toContainEqual({ name: 'CLAUDE.md', result: 'kept-file' })
      expect(readFileSync(join(userDir, 'CLAUDE.md'), 'utf-8')).toBe('user\n')
    }
  )

  it('is idempotent across launches', () => {
    writeFileSync(join(userDir, 'settings.json'), '{}\n')
    linkSharedClaudeConfig(pinnedDir, userDir)
    const second = linkSharedClaudeConfig(pinnedDir, userDir)
    expect(second.every((outcome) => outcome.result === 'present')).toBe(true)
  })
})

describe('mergePinnedClaudeState', () => {
  it('takes the pinned identity, the user shared keys and the union of folder trust', () => {
    const merged = mergePinnedClaudeState(
      {
        oauthAccount: { accountUuid: 'stale' },
        projects: { '/repo/b': { hasTrustDialogAccepted: true, lastSessionId: 'pinned' } }
      },
      {
        oauthAccount: { accountUuid: 'user-global' },
        primaryApiKey: 'must-not-copy',
        theme: 'dark',
        mcpServers: { tool: { command: 'x' } },
        projects: {
          '/repo/a': { hasTrustDialogAccepted: true },
          '/repo/b': { hasTrustDialogAccepted: false, lastSessionId: 'user' }
        }
      },
      { accountUuid: 'pinned-account' }
    )
    expect(merged).toMatchObject({
      oauthAccount: { accountUuid: 'pinned-account' },
      hasCompletedOnboarding: true,
      theme: 'dark',
      mcpServers: { tool: { command: 'x' } },
      projects: {
        '/repo/a': { hasTrustDialogAccepted: true },
        '/repo/b': { hasTrustDialogAccepted: true, lastSessionId: 'pinned' }
      }
    })
    expect(merged).not.toHaveProperty('primaryApiKey')
  })

  it('drops an identity card when the managed account has none', () => {
    expect(
      mergePinnedClaudeState({ oauthAccount: { accountUuid: 'x' } }, {}, null)
    ).not.toHaveProperty('oauthAccount')
  })
})

describe('seedPinnedClaudeState', () => {
  it('creates the state file with onboarding done so the first launch is not blocked', async () => {
    mkdirSync(pinnedDir, { recursive: true })
    const pinnedConfigPath = join(pinnedDir, '.claude.json')
    await seedPinnedClaudeState({
      pinnedConfigPath,
      userConfigPath: join(root, 'home', '.claude.json'),
      oauthAccount: { accountUuid: 'pinned-account' }
    })
    expect(JSON.parse(readFileSync(pinnedConfigPath, 'utf-8'))).toMatchObject({
      hasCompletedOnboarding: true,
      oauthAccount: { accountUuid: 'pinned-account' }
    })
  })

  it('leaves a malformed pinned state file for Claude to repair', async () => {
    mkdirSync(pinnedDir, { recursive: true })
    const pinnedConfigPath = join(pinnedDir, '.claude.json')
    writeFileSync(pinnedConfigPath, '{broken')
    await seedPinnedClaudeState({
      pinnedConfigPath,
      userConfigPath: join(root, 'home', '.claude.json'),
      oauthAccount: null
    })
    expect(readFileSync(pinnedConfigPath, 'utf-8')).toBe('{broken')
  })
})
