import { describe, expect, it } from 'vitest'
import { isDirectClaudeCommand } from './claude-agent-teams-tmux-compat'
import { resolveAgentStartupPlanInputs } from './agent-startup-plan-inputs'
import { buildAgentStartupPlan } from './tui-agent-startup'
import { tokenizeStartupCommand } from './tui-agent-startup-shell'
import {
  appendSessionInstructionsArg,
  getTuiAgentDefaultSessionInstructions,
  MAX_TUI_AGENT_SESSION_INSTRUCTIONS_LENGTH,
  normalizeTuiAgentSessionInstructionsRecord,
  resolveTuiAgentSessionInstructions
} from './tui-agent-session-instructions'

function buildTeamsLaunch(platform: NodeJS.Platform, instructions: string) {
  const inputs = resolveAgentStartupPlanInputs({
    agent: 'claude-agent-teams',
    settings: {
      agentDefaultArgs: { 'claude-agent-teams': '' },
      agentSessionInstructions: { 'claude-agent-teams': instructions }
    },
    platform,
    isRemote: false
  })
  return buildAgentStartupPlan({ ...inputs, prompt: '', allowEmptyPromptLaunch: true })
}

describe('resolveTuiAgentSessionInstructions', () => {
  it('falls back to the built-in default for Agent Teams when unset', () => {
    expect(resolveTuiAgentSessionInstructions('claude-agent-teams', undefined)).toBe(
      getTuiAgentDefaultSessionInstructions('claude-agent-teams')
    )
  })

  it('treats a stored empty string as turned off', () => {
    expect(
      resolveTuiAgentSessionInstructions('claude-agent-teams', { 'claude-agent-teams': '' })
    ).toBe(null)
  })

  it('ignores agents without the setting', () => {
    expect(resolveTuiAgentSessionInstructions('claude', { claude: 'use a team' })).toBe(null)
  })
})

describe('normalizeTuiAgentSessionInstructionsRecord', () => {
  it('drops unknown agents and non-strings, trims and caps the length', () => {
    expect(
      normalizeTuiAgentSessionInstructionsRecord({
        'claude-agent-teams': `  ${'x'.repeat(MAX_TUI_AGENT_SESSION_INSTRUCTIONS_LENGTH + 10)}  `,
        'not-an-agent': 'x',
        claude: 3
      })
    ).toEqual({ 'claude-agent-teams': 'x'.repeat(MAX_TUI_AGENT_SESSION_INSTRUCTIONS_LENGTH) })
  })
})

describe('appendSessionInstructionsArg', () => {
  it('quotes the text for each shell and folds newlines into one line', () => {
    const instructions = "Use a team & don't > solo\nfor big tasks"
    expect(appendSessionInstructionsArg({ command: 'claude', instructions, shell: 'posix' })).toBe(
      `claude --append-system-prompt 'Use a team & don'"'"'t > solo for big tasks'`
    )
    expect(
      appendSessionInstructionsArg({ command: 'claude', instructions, shell: 'powershell' })
    ).toBe(`claude --append-system-prompt 'Use a team & don''t > solo for big tasks'`)
    expect(appendSessionInstructionsArg({ command: 'claude', instructions, shell: 'cmd' })).toBe(
      `claude --append-system-prompt "Use a team ^& don't ^> solo for big tasks"`
    )
  })

  it('defers to a system-prompt flag the user already configured', () => {
    expect(
      appendSessionInstructionsArg({
        command: 'claude',
        instructions: 'team',
        agentArgs: '--append-system-prompt mine',
        shell: 'posix'
      })
    ).toBe('claude')
  })
})

describe('Agent Teams launch with session instructions', () => {
  it('keeps the launch a direct claude command on Windows so the team env still applies', () => {
    const plan = buildTeamsLaunch('win32', 'Team up & split > work')

    expect(plan?.launchCommand).toBe(
      "claude --teammate-mode auto --append-system-prompt 'Team up & split > work'"
    )
    expect(isDirectClaudeCommand(plan?.launchCommand)).toBe(true)
    // Why: resume replays launchConfig.agentCommand, so the instruction must survive there.
    expect(plan?.launchConfig.agentCommand).toContain('--append-system-prompt')
  })

  it('forwards the flag through the dolphin claude-teams wrapper elsewhere', () => {
    expect(buildTeamsLaunch('darwin', 'Team up')?.launchCommand).toMatch(
      /claude-teams --append-system-prompt 'Team up'$/
    )
  })
})

describe('Agent Teams default session instructions', () => {
  const defaultText = getTuiAgentDefaultSessionInstructions('claude-agent-teams')
  const singleLine = defaultText.replace(/\s*[\r\n]+\s*/g, ' ')

  it('fits the command-line cap', () => {
    expect(defaultText.length).toBeGreaterThan(0)
    expect(defaultText.length).toBeLessThanOrEqual(MAX_TUI_AGENT_SESSION_INSTRUCTIONS_LENGTH)
  })

  it('avoids characters a Windows launch line cannot carry', () => {
    // Why: PowerShell 5.1 drops embedded `"` from native argv, cmd cannot quote it, and a
    // backtick in cmd's "…" makes isDirectClaudeCommand drop the Agent Teams env.
    expect(defaultText).not.toMatch(/["`]/)
    // Why: cmd's ^-escapes stay literal inside "…", so the carets would reach Claude.
    expect(defaultText).not.toMatch(/[()&|<>%!^]/)
  })

  it.each(['posix', 'powershell'] as const)('round-trips intact through %s quoting', (shell) => {
    const command = appendSessionInstructionsArg({
      command: 'claude',
      instructions: defaultText,
      shell
    })
    const tokenized = tokenizeStartupCommand(command, shell)
    expect(tokenized.ok && tokenized.tokens).toEqual([
      'claude',
      '--append-system-prompt',
      singleLine
    ])
    expect(tokenized.ok && tokenized.spans.some((span) => span.divergesFromShell)).toBe(false)
  })

  it.each(['posix', 'powershell', 'cmd'] as const)(
    'keeps the %s launch a direct claude command',
    (shell) => {
      expect(
        isDirectClaudeCommand(
          appendSessionInstructionsArg({ command: 'claude', instructions: defaultText, shell })
        )
      ).toBe(true)
    }
  )

  it('keeps the default Windows Agent Teams launch direct', () => {
    const plan = buildTeamsLaunch('win32', defaultText)
    expect(isDirectClaudeCommand(plan?.launchCommand)).toBe(true)
    expect(plan?.launchCommand).toContain('--append-system-prompt')
  })
})

describe('isDirectClaudeCommand quoting', () => {
  it('still rejects operators outside quotes and backticks inside double quotes', () => {
    expect(isDirectClaudeCommand("claude 'a & b'")).toBe(true)
    expect(isDirectClaudeCommand('claude "a ^& b"')).toBe(true)
    expect(isDirectClaudeCommand("claude 'a' & calc")).toBe(false)
    expect(isDirectClaudeCommand('claude "`whoami`"')).toBe(false)
  })
})
