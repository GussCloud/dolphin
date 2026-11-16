import { describe, expect, it } from 'vitest'
import { bypassClaudeShellFunction } from './claude-shell-function-bypass'
import type { ClaudeRuntimeAuthPreparation } from '../runtime-auth/runtime-auth-types'

const managed: ClaudeRuntimeAuthPreparation = {
  configDir: '/h/.claude-empresa',
  runtime: 'host',
  envPatch: { CLAUDE_CONFIG_DIR: '/h/.claude-empresa' },
  stripAuthEnv: true,
  provenance: 'managed:acct:linked'
}
const deps = {
  platform: 'darwin' as const,
  hasClaudeShellFunction: () => true,
  resolveClaude: () => '/Users/me/.local/bin/claude'
}

describe('bypassClaudeShellFunction', () => {
  it('runs the real executable when Dolphin chose the account and zsh wraps `claude`', () => {
    expect(bypassClaudeShellFunction('claude --resume abc', managed, {}, deps)).toBe(
      "'/Users/me/.local/bin/claude' --resume abc"
    )
  })

  it("leaves the user's menu alone when Dolphin did not choose an account", () => {
    const system = { ...managed, envPatch: {}, provenance: 'system' }
    expect(bypassClaudeShellFunction('claude', system, {}, deps)).toBe('claude')
    expect(bypassClaudeShellFunction('claude', null, {}, deps)).toBe('claude')
  })

  it('changes nothing without a `claude` function or on Windows', () => {
    expect(
      bypassClaudeShellFunction(
        'claude',
        managed,
        {},
        { ...deps, hasClaudeShellFunction: () => false }
      )
    ).toBe('claude')
    expect(bypassClaudeShellFunction('claude', managed, {}, { ...deps, platform: 'win32' })).toBe(
      'claude'
    )
  })

  it('falls back to the `command` builtin when the CLI is not on PATH', () => {
    expect(
      bypassClaudeShellFunction(
        "A=1 claude '--x' --resume abc",
        managed,
        {},
        { ...deps, resolveClaude: () => 'claude' }
      )
    ).toBe("A=1 command claude '--x' --resume abc")
  })

  it('skips the menu for a resume Dolphin routed to the folder holding the conversation', () => {
    for (const provenance of ['system:resume-owner', 'menu-folder:resume-owner']) {
      expect(
        bypassClaudeShellFunction('claude --resume abc', { ...managed, provenance }, {}, deps)
      ).toBe("'/Users/me/.local/bin/claude' --resume abc")
    }
  })

  it('quotes a path with spaces and keeps an already explicit executable', () => {
    expect(
      bypassClaudeShellFunction(
        'claude',
        managed,
        {},
        {
          ...deps,
          resolveClaude: () => '/Users/me/My Tools/claude'
        }
      )
    ).toBe("'/Users/me/My Tools/claude'")
    expect(bypassClaudeShellFunction('/opt/claude --x', managed, {}, deps)).toBe('/opt/claude --x')
  })
})
