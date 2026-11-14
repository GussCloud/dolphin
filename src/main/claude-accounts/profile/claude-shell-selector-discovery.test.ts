import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  claudeConfigStatePath,
  discoverClaudeShellSelector,
  expandShellPath
} from './claude-shell-selector-discovery'

let home = ''

function account(dir: string, email: string, statePath = join(dir, '.claude.json')): void {
  mkdirSync(dir, { recursive: true })
  writeFileSync(statePath, JSON.stringify({ oauthAccount: { emailAddress: email } }))
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'dolphin-selector-home-'))
})

afterEach(() => {
  rmSync(home, { recursive: true, force: true })
})

describe('discoverClaudeShellSelector', () => {
  it('finds the account dirs of a zsh `claude` menu sourced from .zshrc', () => {
    account(join(home, '.claude'), 'me@personal.test', join(home, '.claude.json'))
    account(join(home, '.claude-empresa'), 'me@corp.test')
    writeFileSync(
      join(home, '.claude', 'contas.zsh'),
      [
        'claude() {',
        '  echo "1) Pessoal  2) Empresa"',
        '  read -r opcao',
        '  case "$opcao" in',
        '    2) CLAUDE_CONFIG_DIR="$HOME/.claude-empresa" command claude "$@" ;;',
        '    *) command claude "$@" ;;',
        '  esac',
        '}'
      ].join('\n')
    )
    writeFileSync(
      join(home, '.zshrc'),
      '[ -f ~/.claude/contas.zsh ] && source ~/.claude/contas.zsh\n'
    )

    const discovery = discoverClaudeShellSelector(home)

    expect(discovery.selectorFile).toBe(join(home, '.claude', 'contas.zsh'))
    expect(discovery.folders).toEqual([
      {
        configDir: join(home, '.claude-empresa'),
        isDefault: false,
        email: 'me@corp.test',
        organizationName: null,
        organizationUuid: null
      },
      {
        configDir: join(home, '.claude'),
        isDefault: true,
        email: 'me@personal.test',
        organizationName: null,
        organizationUuid: null
      }
    ])
  })

  it('reads dirs kept in an array and assigned through a variable', () => {
    account(join(home, '.claude-a'), 'a@test')
    account(join(home, '.claude-b'), 'b@test')
    writeFileSync(
      join(home, '.zshrc'),
      [
        'function claude {',
        '  local dirs=(~/.claude-a ${HOME}/.claude-b)',
        '  export CLAUDE_CONFIG_DIR=${dirs[$REPLY]}',
        '  command claude "$@"',
        '}'
      ].join('\n')
    )

    const dirs = discoverClaudeShellSelector(home).folders.map((folder) => folder.configDir)

    expect(dirs).toEqual([join(home, '.claude-a'), join(home, '.claude-b')])
  })

  it('finds nothing without a `claude` function, and skips the DeepSeek dir', () => {
    account(join(home, '.claude-empresa'), 'me@corp.test')
    writeFileSync(join(home, '.zshrc'), 'export CLAUDE_CONFIG_DIR=~/.claude-empresa\n')
    expect(discoverClaudeShellSelector(home)).toEqual({ selectorFile: null, folders: [] })

    account(join(home, '.claude-deepseek'), 'x@test')
    writeFileSync(
      join(home, '.zshrc'),
      'claude() { CLAUDE_CONFIG_DIR=~/.claude-deepseek command claude }\n'
    )
    expect(discoverClaudeShellSelector(home).folders.map((folder) => folder.configDir)).toEqual([])
  })
})

describe('shell paths', () => {
  it('expands home forms and refuses dynamic values', () => {
    expect(expandShellPath('"$HOME/.claude-x"', '/h')).toBe('/h/.claude-x')
    expect(expandShellPath('~/.claude-x', '/h')).toBe('/h/.claude-x')
    expect(expandShellPath('$dir', '/h')).toBeNull()
    expect(expandShellPath('relative/dir', '/h')).toBeNull()
  })

  it('keeps the default dir state beside the home dir', () => {
    expect(claudeConfigStatePath('/h/.claude', '/h')).toBe('/h/.claude.json')
    expect(claudeConfigStatePath('/h/.claude-x', '/h')).toBe('/h/.claude-x/.claude.json')
  })
})
