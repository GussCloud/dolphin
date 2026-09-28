import { describe, expect, it } from 'vitest'
import {
  encodeClaudeProjectPath,
  encodeClaudeProjectPaths,
  isClaudeProjectDirInScope
} from './claude-project-dir-encoding'

describe('encodeClaudeProjectPath', () => {
  it('emits one dash per non-alphanumeric character rather than per run', () => {
    // The distinction is the whole contract: collapsing runs stops matching real bucket names.
    expect(encodeClaudeProjectPath('/Users/ada/dolphin/workspaces')).toBe(
      '-Users-ada-dolphin-workspaces'
    )
    expect(encodeClaudeProjectPath('/Users/ada/.dolphin/worktrees')).toBe(
      '-Users-ada--dolphin-worktrees'
    )
  })

  it('encodes a Windows drive path', () => {
    expect(encodeClaudeProjectPath('C:\\Users\\ada\\dolphin\\workspaces')).toBe(
      'C--Users-ada-dolphin-workspaces'
    )
    expect(encodeClaudeProjectPath('C:\\')).toBe('C--')
  })

  it('encodes a WSL UNC path', () => {
    expect(encodeClaudeProjectPath('\\\\wsl$\\Ubuntu\\home\\ada\\dolphin\\workspaces')).toBe(
      '--wsl--Ubuntu-home-ada-dolphin-workspaces'
    )
  })

  it('drops trailing separators but keeps a bare root', () => {
    expect(encodeClaudeProjectPath('/Users/ada/dolphin/')).toBe('-Users-ada-dolphin')
    expect(encodeClaudeProjectPath('/')).toBe('-')
  })

  it('offers the NFC spelling alongside the raw one', () => {
    const nfd = '/Users/ada/cafe\u0301'
    expect(encodeClaudeProjectPaths(nfd)).toEqual([
      encodeClaudeProjectPath(nfd),
      encodeClaudeProjectPath(nfd.normalize('NFC'))
    ])
    expect(encodeClaudeProjectPaths('/Users/ada/cafe')).toEqual(['-Users-ada-cafe'])
  })
})

describe('isClaudeProjectDirInScope', () => {
  it('accepts the prefix itself and its dash-delimited descendants', () => {
    expect(isClaudeProjectDirInScope('-w-dolphin', ['-w-dolphin'])).toBe(true)
    expect(isClaudeProjectDirInScope('-w-dolphin-nautilus', ['-w-dolphin'])).toBe(true)
  })

  it('rejects a sibling that merely starts with the prefix', () => {
    // Without the boundary, "dolphin" would absorb every workspace under "dolphindyne".
    expect(isClaudeProjectDirInScope('-w-dolphindyne-nautilus', ['-w-dolphin'])).toBe(false)
  })
})
