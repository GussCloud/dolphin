import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  CLAUDE_PROFILE_MARKER,
  isolateClaudeProfileDir,
  mergeClaudeProfileState,
  readClaudeProfileMarker,
  seedClaudeProfileState
} from './claude-pinned-config-layout'

let root = ''
let userDir = ''
let profileDir = ''

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'dolphin-claude-profile-'))
  userDir = join(root, 'home', '.claude')
  profileDir = join(root, 'userData', 'claude-accounts', 'acct', 'config')
  mkdirSync(userDir, { recursive: true })
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function isLink(path: string): boolean {
  return lstatSync(path).isSymbolicLink()
}

describe('isolateClaudeProfileDir', () => {
  it('starts a new profile empty: nothing of the user dir is shared except IDE lock files', () => {
    writeFileSync(join(userDir, 'CLAUDE.md'), '# personal rules\n')
    writeFileSync(join(userDir, 'settings.json'), '{"model":"opus"}\n')
    mkdirSync(join(userDir, 'skills', 'vps'), { recursive: true })
    mkdirSync(join(userDir, 'projects', '-repo'), { recursive: true })

    const isolation = isolateClaudeProfileDir(profileDir, userDir)

    expect(isolation).toEqual({ firstIsolation: true, copied: [], detached: [] })
    for (const name of ['CLAUDE.md', 'settings.json', 'skills', 'projects', 'history.jsonl']) {
      expect(existsSync(join(profileDir, name))).toBe(false)
    }
    expect(readClaudeProfileMarker(profileDir)).toEqual({ version: 1 })
  })

  it.skipIf(process.platform === 'win32')(
    'keeps the ide folder shared so /ide still finds the editor lock files',
    () => {
      isolateClaudeProfileDir(profileDir, userDir)
      expect(isLink(join(profileDir, 'ide'))).toBe(true)
    }
  )

  it.skipIf(process.platform === 'win32')(
    'migrates the shared layout into own copies without touching the user dir',
    () => {
      writeFileSync(join(userDir, 'CLAUDE.md'), '# personal rules\n')
      writeFileSync(join(userDir, 'settings.json'), '{"model":"opus"}\n')
      mkdirSync(join(userDir, 'skills', 'vps'), { recursive: true })
      writeFileSync(join(userDir, 'skills', 'vps', 'SKILL.md'), 'deploy\n')
      mkdirSync(join(userDir, 'projects', '-repo'), { recursive: true })
      writeFileSync(join(userDir, 'projects', '-repo', 's.jsonl'), '{}\n')
      writeFileSync(join(userDir, 'history.jsonl'), '{"display":"hi"}\n')
      mkdirSync(profileDir, { recursive: true })
      // The layout earlier versions wrote: every curated entry was a link into the user dir.
      for (const name of ['CLAUDE.md', 'settings.json', 'skills', 'projects', 'history.jsonl']) {
        symlinkSync(join(userDir, name), join(profileDir, name))
      }

      const isolation = isolateClaudeProfileDir(profileDir, userDir)

      expect(isolation.firstIsolation).toBe(true)
      expect(isolation.copied.sort()).toEqual(['CLAUDE.md', 'settings.json', 'skills'])
      expect(isolation.detached.sort()).toEqual(['history.jsonl', 'projects'])
      expect(isLink(join(profileDir, 'CLAUDE.md'))).toBe(false)
      expect(readFileSync(join(profileDir, 'CLAUDE.md'), 'utf-8')).toBe('# personal rules\n')
      expect(isLink(join(profileDir, 'skills'))).toBe(false)
      expect(readFileSync(join(profileDir, 'skills', 'vps', 'SKILL.md'), 'utf-8')).toBe('deploy\n')
      expect(existsSync(join(profileDir, 'projects'))).toBe(false)
      // The user's own files and history are intact.
      expect(readFileSync(join(userDir, 'CLAUDE.md'), 'utf-8')).toBe('# personal rules\n')
      expect(existsSync(join(userDir, 'projects', '-repo', 's.jsonl'))).toBe(true)
      expect(readFileSync(join(userDir, 'history.jsonl'), 'utf-8')).toBe('{"display":"hi"}\n')
      expect(readClaudeProfileMarker(profileDir)).toMatchObject({
        version: 1,
        reviewPending: true,
        copied: expect.arrayContaining(['CLAUDE.md', 'settings.json', 'skills'])
      })

      // Editing the profile no longer edits the user's file.
      writeFileSync(join(profileDir, 'CLAUDE.md'), '# company rules\n')
      expect(readFileSync(join(userDir, 'CLAUDE.md'), 'utf-8')).toBe('# personal rules\n')
    }
  )

  it.skipIf(process.platform === 'win32')(
    'is idempotent and keeps files the profile already owns',
    () => {
      mkdirSync(profileDir, { recursive: true })
      writeFileSync(join(userDir, 'CLAUDE.md'), '# personal\n')
      writeFileSync(join(profileDir, 'CLAUDE.md'), '# company\n')

      expect(isolateClaudeProfileDir(profileDir, userDir).copied).toEqual([])
      const second = isolateClaudeProfileDir(profileDir, userDir)

      expect(second).toEqual({ firstIsolation: false, copied: [], detached: [] })
      expect(readFileSync(join(profileDir, 'CLAUDE.md'), 'utf-8')).toBe('# company\n')
    }
  )

  // The layout `npx skills` writes on macOS/Linux: a relative link from ~/.claude/skills.
  function installRelativeAgentsSkill(name: string): string {
    const canonical = join(root, 'home', '.agents', 'skills', name)
    mkdirSync(canonical, { recursive: true })
    writeFileSync(join(canonical, 'SKILL.md'), `${name}\n`)
    mkdirSync(join(userDir, 'skills'), { recursive: true })
    symlinkSync(join('..', '..', '.agents', 'skills', name), join(userDir, 'skills', name))
    return canonical
  }

  it.skipIf(process.platform === 'win32')(
    'keeps relative skill links working when it copies a linked skills folder',
    () => {
      installRelativeAgentsSkill('orchestration')
      mkdirSync(profileDir, { recursive: true })
      symlinkSync(join(userDir, 'skills'), join(profileDir, 'skills'))

      isolateClaudeProfileDir(profileDir, userDir)

      const link = join(profileDir, 'skills', 'orchestration')
      expect(isLink(link)).toBe(true)
      expect(readFileSync(join(link, 'SKILL.md'), 'utf-8')).toBe('orchestration\n')
    }
  )

  it.skipIf(process.platform === 'win32')(
    'repoints relative skill links an earlier copy left broken, and nothing else',
    () => {
      const canonical = installRelativeAgentsSkill('orchestration')
      mkdirSync(join(profileDir, 'skills'), { recursive: true })
      // What earlier versions copied: the link text, now relative to the wrong folder.
      symlinkSync(
        join('..', '..', '.agents', 'skills', 'orchestration'),
        join(profileDir, 'skills', 'orchestration')
      )
      symlinkSync(join('..', 'gone'), join(profileDir, 'skills', 'unknown'))

      const isolation = isolateClaudeProfileDir(profileDir, userDir)

      const link = join(profileDir, 'skills', 'orchestration')
      expect(readFileSync(join(link, 'SKILL.md'), 'utf-8')).toBe('orchestration\n')
      expect(realpathSync(link)).toBe(realpathSync(canonical))
      expect(readlinkSync(join(profileDir, 'skills', 'unknown'))).toBe(join('..', 'gone'))
      expect(isolation.copied).toEqual([])
    }
  )

  it('writes the marker inside the profile', () => {
    isolateClaudeProfileDir(profileDir, userDir)
    expect(existsSync(join(profileDir, CLAUDE_PROFILE_MARKER))).toBe(true)
  })
})

describe('mergeClaudeProfileState', () => {
  const user = {
    theme: 'dark',
    mcpServers: { cpanel: { command: 'cpanel-mcp', env: { TOKEN: 'personal' } } },
    bypassPermissionsModeAccepted: true,
    projects: { '/repo': { hasTrustDialogAccepted: true } }
  }

  it("never takes the user's MCP servers, permission bypass or folder trust", () => {
    const next = mergeClaudeProfileState({}, user, null)
    expect(next.mcpServers).toBeUndefined()
    expect(next.bypassPermissionsModeAccepted).toBeUndefined()
    expect(next.projects).toBeUndefined()
    expect(next.theme).toBe('dark')
    expect(next.hasCompletedOnboarding).toBe(true)
  })

  it('keeps what the profile already set and only fills in missing defaults', () => {
    const next = mergeClaudeProfileState(
      { theme: 'light', mcpServers: { company: { command: 'c' } } },
      user,
      null
    )
    expect(next.theme).toBe('light')
    expect(next.mcpServers).toEqual({ company: { command: 'c' } })
  })

  it('drops the MCP servers and bypass the shared layout copied in, on first isolation', () => {
    const next = mergeClaudeProfileState(
      { mcpServers: user.mcpServers, bypassPermissionsModeAccepted: true },
      user,
      null,
      { dropInheritedSharedState: true }
    )
    expect(next.mcpServers).toBeUndefined()
    expect(next.bypassPermissionsModeAccepted).toBeUndefined()
  })

  it("describes only this account's identity", () => {
    expect(mergeClaudeProfileState({}, {}, { emailAddress: 'a@corp' }).oauthAccount).toEqual({
      emailAddress: 'a@corp'
    })
    expect(
      mergeClaudeProfileState({ oauthAccount: { emailAddress: 'old' } }, {}, null).oauthAccount
    ).toBeUndefined()
  })
})

describe('seedClaudeProfileState', () => {
  it('creates the profile state file under lock', async () => {
    mkdirSync(profileDir, { recursive: true })
    writeFileSync(join(userDir, '.claude.json'), JSON.stringify({ theme: 'dark' }))
    await seedClaudeProfileState({
      profileConfigPath: join(profileDir, '.claude.json'),
      userConfigPath: join(userDir, '.claude.json'),
      oauthAccount: { emailAddress: 'a@corp' }
    })
    expect(JSON.parse(readFileSync(join(profileDir, '.claude.json'), 'utf-8'))).toEqual({
      theme: 'dark',
      hasCompletedOnboarding: true,
      oauthAccount: { emailAddress: 'a@corp' }
    })
  })

  it('leaves a malformed profile state file alone', async () => {
    mkdirSync(profileDir, { recursive: true })
    writeFileSync(join(profileDir, '.claude.json'), '{not json')
    await seedClaudeProfileState({
      profileConfigPath: join(profileDir, '.claude.json'),
      userConfigPath: join(userDir, '.claude.json'),
      oauthAccount: null
    })
    expect(readFileSync(join(profileDir, '.claude.json'), 'utf-8')).toBe('{not json')
  })
})
