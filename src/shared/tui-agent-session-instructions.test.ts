import { describe, expect, it } from 'vitest'
import { isDirectClaudeCommand } from './claude-agent-teams-tmux-compat'
import { resolveAgentStartupPlanInputs } from './agent-startup-plan-inputs'
import { buildAgentStartupPlan } from './tui-agent-startup'
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

describe('isDirectClaudeCommand quoting', () => {
  it('still rejects operators outside quotes and backticks inside double quotes', () => {
    expect(isDirectClaudeCommand("claude 'a & b'")).toBe(true)
    expect(isDirectClaudeCommand('claude "a ^& b"')).toBe(true)
    expect(isDirectClaudeCommand("claude 'a' & calc")).toBe(false)
    expect(isDirectClaudeCommand('claude "`whoami`"')).toBe(false)
  })
})
