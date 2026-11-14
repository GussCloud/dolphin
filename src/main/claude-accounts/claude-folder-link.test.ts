import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createLinkedClaudeAccount, discoverClaudeConfigFolders } from './claude-folder-link'

let home = ''

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'dolphin-folder-link-'))
})

afterEach(() => {
  rmSync(home, { recursive: true, force: true })
})

function folder(name: string, oauthAccount: unknown): string {
  const dir = join(home, name)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, '.claude.json'), JSON.stringify({ oauthAccount }))
  return dir
}

describe('createLinkedClaudeAccount', () => {
  it('links a folder under the identity its last login left there', () => {
    const dir = folder('.claude-empresa', {
      emailAddress: 'me@corp.test',
      organizationName: 'Corp',
      organizationUuid: 'org-1'
    })

    const account = createLinkedClaudeAccount({ claudeManagedAccounts: [] }, dir, home, 5)

    expect(account).toMatchObject({
      email: 'me@corp.test',
      organizationName: 'Corp',
      organizationUuid: 'org-1',
      linkedConfigDir: dir,
      managedAuthPath: dir,
      managedAuthRuntime: 'host',
      createdAt: 5
    })
  })

  it('refuses a folder twice, a folder with no login, and anything that is not a Claude folder', () => {
    const dir = folder('.claude-empresa', { emailAddress: 'me@corp.test' })
    const linked = createLinkedClaudeAccount({ claudeManagedAccounts: [] }, dir, home)
    expect(() => createLinkedClaudeAccount({ claudeManagedAccounts: [linked] }, dir, home)).toThrow(
      'already linked'
    )

    expect(() =>
      createLinkedClaudeAccount({ claudeManagedAccounts: [] }, folder('.claude-new', {}), home)
    ).toThrow('No Claude login')

    mkdirSync(join(home, 'Documents'))
    expect(() =>
      createLinkedClaudeAccount({ claudeManagedAccounts: [] }, join(home, 'Documents'), home)
    ).toThrow('not a Claude config folder')
  })
})

describe('discoverClaudeConfigFolders', () => {
  it('marks the folders that are already linked', () => {
    const dir = folder('.claude-empresa', { emailAddress: 'me@corp.test' })
    writeFileSync(
      join(home, '.zshrc'),
      'claude() { CLAUDE_CONFIG_DIR=~/.claude-empresa command claude }\n'
    )
    const linked = createLinkedClaudeAccount({ claudeManagedAccounts: [] }, dir, home)

    const discovery = discoverClaudeConfigFolders({ claudeManagedAccounts: [linked] }, home)

    expect(discovery.folders).toEqual([
      expect.objectContaining({ configDir: dir, linkedAccountId: linked.id })
    ])
  })
})
