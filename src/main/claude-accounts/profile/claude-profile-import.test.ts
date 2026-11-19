import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { importIntoClaudeProfile, listClaudeProfileImportItems } from './claude-profile-import'

let root = ''
let userDir = ''
let userStatePath = ''
let profileDir = ''

function json(path: string, value: unknown): void {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, JSON.stringify(value))
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf-8'))
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'dolphin-profile-import-'))
  userDir = join(root, 'home', '.claude')
  userStatePath = join(root, 'home', '.claude.json')
  profileDir = join(root, 'userData', 'claude-accounts', 'work', 'config')
  mkdirSync(join(userDir, 'skills', 'deploy'), { recursive: true })
  writeFileSync(join(userDir, 'skills', 'deploy', 'SKILL.md'), 'deploy\n')
  mkdirSync(join(userDir, 'agents'), { recursive: true })
  writeFileSync(join(userDir, 'agents', 'reviewer.md'), 'review\n')
  writeFileSync(join(userDir, 'CLAUDE.md'), '# personal\n')
  json(userStatePath, {
    mcpServers: { vps: { command: 'ssh-mcp', env: { KEY: 'secret' } }, github: { command: 'gh' } }
  })
  const pluginPath = join(userDir, 'plugins', 'cache', 'acme', 'lint', '1.0.0')
  mkdirSync(pluginPath, { recursive: true })
  writeFileSync(join(pluginPath, 'plugin.json'), '{}')
  json(join(userDir, 'plugins', 'installed_plugins.json'), {
    version: 2,
    plugins: {
      'lint@acme': [{ scope: 'user', installPath: pluginPath, version: '1.0.0' }],
      'local@acme': [{ scope: 'project', installPath: pluginPath, projectPath: '/repo' }]
    }
  })
  const marketplacePath = join(userDir, 'plugins', 'marketplaces', 'acme')
  mkdirSync(marketplacePath, { recursive: true })
  json(join(userDir, 'plugins', 'known_marketplaces.json'), {
    acme: { source: { source: 'github', repo: 'acme/plugins' }, installLocation: marketplacePath }
  })
  mkdirSync(profileDir, { recursive: true })
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

const paths = () => ({ userConfigDir: userDir, userStatePath, profileDir })

describe('listClaudeProfileImportItems', () => {
  it('lists what the user has, flags accesses as sensitive and skips project-only plugins', () => {
    const items = listClaudeProfileImportItems(paths())
    expect(items.map((entry) => entry.id)).toEqual([
      'instructions:CLAUDE.md',
      'skill:deploy',
      'agent:reviewer.md',
      'mcp-server:vps',
      'mcp-server:github',
      'plugin:lint@acme'
    ])
    expect(items.filter((entry) => entry.sensitive).map((entry) => entry.kind)).toEqual([
      'mcp-server',
      'mcp-server',
      'plugin'
    ])
  })
})

describe('importIntoClaudeProfile', () => {
  it('imports only what was chosen and leaves the user dir untouched', async () => {
    const result = await importIntoClaudeProfile(paths(), ['skill:deploy', 'mcp-server:github'])

    expect(result).toEqual({ imported: ['skill:deploy', 'mcp-server:github'], skipped: [] })
    expect(readFileSync(join(profileDir, 'skills', 'deploy', 'SKILL.md'), 'utf-8')).toBe('deploy\n')
    expect(readJson(join(profileDir, '.claude.json')).mcpServers).toEqual({
      github: { command: 'gh' }
    })
    expect(readJson(userStatePath).mcpServers).toHaveProperty('vps')
  })

  it('never overwrites what the profile already has', async () => {
    writeFileSync(join(profileDir, 'CLAUDE.md'), '# company\n')
    const result = await importIntoClaudeProfile(paths(), ['instructions:CLAUDE.md'])
    expect(result.skipped).toEqual(['instructions:CLAUDE.md'])
    expect(readFileSync(join(profileDir, 'CLAUDE.md'), 'utf-8')).toBe('# company\n')
  })

  it("copies a plugin with its marketplace and points every path at the profile's copy", async () => {
    await importIntoClaudeProfile(paths(), ['plugin:lint@acme'])

    const copied = join(profileDir, 'plugins', 'cache', 'acme', 'lint', '1.0.0')
    expect(readJson(join(profileDir, 'plugins', 'installed_plugins.json'))).toMatchObject({
      plugins: { 'lint@acme': [{ scope: 'user', installPath: copied }] }
    })
    expect(readFileSync(join(copied, 'plugin.json'), 'utf-8')).toBe('{}')
    expect(readJson(join(profileDir, 'plugins', 'known_marketplaces.json'))).toMatchObject({
      acme: { installLocation: join(profileDir, 'plugins', 'marketplaces', 'acme') }
    })
    expect(readJson(join(profileDir, 'settings.json')).enabledPlugins).toEqual({
      'lint@acme': true
    })
  })

  it.skipIf(process.platform === 'win32')('copies a linked skill as a link', async () => {
    mkdirSync(join(root, 'agents-skills', 'shared'), { recursive: true })
    symlinkSync(join(root, 'agents-skills', 'shared'), join(userDir, 'skills', 'shared'))
    await importIntoClaudeProfile(paths(), ['skill:shared'])
    expect(lstatSync(join(profileDir, 'skills', 'shared')).isSymbolicLink()).toBe(true)
  })

  it.skipIf(process.platform === 'win32')(
    'keeps a relative skill link pointing at the same skill after the copy',
    async () => {
      const canonical = join(root, 'home', '.agents', 'skills', 'orchestration')
      mkdirSync(canonical, { recursive: true })
      writeFileSync(join(canonical, 'SKILL.md'), 'orchestration\n')
      // `npx skills` links ~/.claude/skills/<name> relatively on macOS and Linux.
      symlinkSync(
        join('..', '..', '.agents', 'skills', 'orchestration'),
        join(userDir, 'skills', 'orchestration')
      )

      await importIntoClaudeProfile(paths(), ['skill:orchestration'])

      const link = join(profileDir, 'skills', 'orchestration')
      expect(lstatSync(link).isSymbolicLink()).toBe(true)
      expect(readFileSync(join(link, 'SKILL.md'), 'utf-8')).toBe('orchestration\n')
    }
  )
})
