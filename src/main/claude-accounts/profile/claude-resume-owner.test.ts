import { describe, expect, it } from 'vitest'
import type { ClaudeManagedAccount } from '../../../shared/managed-account-types'
import { resolveClaudeResumeOwner } from './claude-resume-owner'

function account(id: string, linkedConfigDir?: string): ClaudeManagedAccount {
  return {
    id,
    email: `${id}@example.test`,
    managedAuthPath: `/managed/${id}`,
    authMethod: 'subscription-oauth',
    organizationUuid: null,
    organizationName: null,
    createdAt: 0,
    updatedAt: 0,
    lastAuthenticatedAt: 0,
    ...(linkedConfigDir ? { linkedConfigDir } : {})
  }
}

const SYSTEM = '/h/.claude'
const pessoal = account('pessoal', SYSTEM)
const empresa = account('empresa', '/h/.claude-empresa')

function owner(holders: Record<string, number>, intended: ClaudeManagedAccount | null = null) {
  return resolveClaudeResumeOwner({
    sessionId: 'abc',
    intended,
    accounts: [pessoal, empresa],
    systemDir: SYSTEM,
    menuFolders: () => ['/h/.claude-cliente'],
    sessionMtime: (dir) => holders[dir] ?? null
  })
}

describe('resolveClaudeResumeOwner', () => {
  it('names the linked account on ~/.claude when no account was chosen', () => {
    expect(owner({ [SYSTEM]: 1 })).toEqual({ kind: 'account', account: pessoal })
  })

  it('names the system folder when no account links ~/.claude', () => {
    const result = resolveClaudeResumeOwner({
      sessionId: 'abc',
      intended: null,
      accounts: [empresa],
      systemDir: SYSTEM,
      menuFolders: () => [],
      sessionMtime: (dir) => (dir === SYSTEM ? 1 : null)
    })
    expect(result).toEqual({ kind: 'folder', configDir: SYSTEM, isSystem: true })
  })

  it('keeps the chosen account when it holds the conversation', () => {
    expect(owner({ '/h/.claude-empresa': 1, [SYSTEM]: 2 }, empresa)).toEqual({ kind: 'none' })
  })

  it('moves to the account that holds it, preferring the newest copy', () => {
    expect(owner({ '/h/.claude-empresa': 5 }, pessoal)).toEqual({
      kind: 'account',
      account: empresa
    })
    expect(owner({ '/h/.claude-empresa': 5, [SYSTEM]: 9 })).toEqual({
      kind: 'account',
      account: pessoal
    })
  })

  it('falls back to a menu folder Dolphin has not linked, and to nothing when none holds it', () => {
    expect(owner({ '/h/.claude-cliente': 1 })).toEqual({
      kind: 'folder',
      configDir: '/h/.claude-cliente',
      isSystem: false
    })
    expect(owner({})).toEqual({ kind: 'none' })
  })
})
