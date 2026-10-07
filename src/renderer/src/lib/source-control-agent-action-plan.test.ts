import { describe, expect, it } from 'vitest'
import { planSourceControlAgentActionLaunch } from './source-control-agent-action-plan'

describe('planSourceControlAgentActionLaunch', () => {
  it('rejects disabled agents', () => {
    expect(
      planSourceControlAgentActionLaunch({
        agent: 'codex',
        commandInput: 'Fix checks',
        promptDelivery: 'submit-after-ready',
        detectedAgents: ['codex'],
        disabledAgents: ['codex'],
        platform: 'darwin'
      })
    ).toEqual({ ok: false, error: 'The selected agent is disabled in Settings.' })
  })

  it('rejects agents not detected on the current host', () => {
    expect(
      planSourceControlAgentActionLaunch({
        agent: 'claude',
        commandInput: 'Fix checks',
        promptDelivery: 'submit-after-ready',
        detectedAgents: ['codex'],
        platform: 'linux'
      })
    ).toEqual({ ok: false, error: 'The selected agent was not detected on this workspace host.' })
  })

  it('mirrors submit-after-ready delivery without embedding the prompt in the command', () => {
    const result = planSourceControlAgentActionLaunch({
      agent: 'codex',
      commandInput: 'Fix checks',
      promptDelivery: 'submit-after-ready',
      detectedAgents: ['codex'],
      platform: 'linux'
    })

    expect(result.ok && result.delivery).toBe('paste-submit')
    // Built-in default args apply when no per-action args are given, as in the real launch.
    expect(result.ok && result.commandLabel).toBe("codex '--dangerously-bypass-approvals-and-sandbox'")
    expect(result.ok && result.summary).toContain('pastes and submits')
    expect(result.ok && result.caveat).toContain('PATH')
  })

  it('includes per-action CLI arguments in submit-after-ready launch plans', () => {
    const result = planSourceControlAgentActionLaunch({
      agent: 'codex',
      commandInput: 'Fix checks',
      agentArgs: '--model gpt-5.5',
      promptDelivery: 'submit-after-ready',
      detectedAgents: ['codex'],
      platform: 'linux'
    })

    expect(result.ok && result.commandLabel).toBe("codex '--model' 'gpt-5.5'")
  })

  it.each([
    {
      terminalWindowsShell: 'cmd.exe',
      expectedCommand: 'powershell.exe -NoProfile -EncodedCommand'
    },
    {
      terminalWindowsShell: 'git-bash',
      expectedCommand: 'DOLPHIN_HERMES_STARTUP_QUERY'
    }
  ])(
    'uses $terminalWindowsShell quoting for Hermes source-control prompts',
    ({ terminalWindowsShell, expectedCommand }) => {
      const result = planSourceControlAgentActionLaunch({
        agent: 'hermes',
        commandInput: 'Review the change',
        promptDelivery: 'auto-submit',
        detectedAgents: ['hermes'],
        platform: 'win32',
        settings: { terminalWindowsShell }
      })

      expect(result.ok && result.plan.launchCommand).toContain(expectedCommand)
      expect(result.ok && result.plan.env?.DOLPHIN_HERMES_STARTUP_QUERY).toBe('Review the change')
    }
  )

  it('rejects invalid per-action CLI arguments', () => {
    expect(
      planSourceControlAgentActionLaunch({
        agent: 'codex',
        commandInput: 'Fix checks',
        agentArgs: '--model "unterminated',
        promptDelivery: 'submit-after-ready',
        detectedAgents: ['codex'],
        platform: 'linux'
      })
    ).toEqual({
      ok: false,
      error: 'CLI arguments are invalid: Unclosed quote in command template.'
    })
  })

  it('uses native draft launch when the selected agent supports it', () => {
    const result = planSourceControlAgentActionLaunch({
      agent: 'claude',
      commandInput: 'Fix checks',
      promptDelivery: 'draft',
      detectedAgents: ['claude'],
      platform: 'darwin'
    })

    expect(result.ok && result.delivery).toBe('draft-native')
    expect(result.ok && result.commandLabel).toContain('--prefill')
  })

  it('applies configured session instructions like the real launch does', () => {
    const result = planSourceControlAgentActionLaunch({
      agent: 'claude-agent-teams',
      commandInput: 'Fix checks',
      promptDelivery: 'submit-after-ready',
      detectedAgents: ['claude-agent-teams'],
      platform: 'linux',
      settings: { agentSessionInstructions: { 'claude-agent-teams': 'Use three teammates.' } }
    })

    expect(result.ok && result.commandLabel).toContain('--append-system-prompt')
    expect(result.ok && result.commandLabel).toContain('Use three teammates.')
  })

  it('omits session instructions the user cleared', () => {
    const result = planSourceControlAgentActionLaunch({
      agent: 'claude-agent-teams',
      commandInput: 'Fix checks',
      promptDelivery: 'submit-after-ready',
      detectedAgents: ['claude-agent-teams'],
      platform: 'linux',
      settings: { agentSessionInstructions: { 'claude-agent-teams': '' } }
    })

    expect(result.ok && result.commandLabel).not.toContain('--append-system-prompt')
  })

  it('falls back to configured default args and env when no per-action args are given', () => {
    const result = planSourceControlAgentActionLaunch({
      agent: 'codex',
      commandInput: 'Fix checks',
      promptDelivery: 'submit-after-ready',
      detectedAgents: ['codex'],
      platform: 'linux',
      settings: {
        agentDefaultArgs: { codex: '--model gpt-5.5' },
        agentDefaultEnv: { codex: { CODEX_HOME: '/tmp/codex' } }
      }
    })

    expect(result.ok && result.commandLabel).toBe("codex '--model' 'gpt-5.5'")
    expect(result.ok && result.plan.env?.CODEX_HOME).toBe('/tmp/codex')
  })

  it('lets per-action args replace the configured default args', () => {
    const result = planSourceControlAgentActionLaunch({
      agent: 'codex',
      commandInput: 'Fix checks',
      agentArgs: '',
      promptDelivery: 'submit-after-ready',
      detectedAgents: ['codex'],
      platform: 'linux',
      settings: { agentDefaultArgs: { codex: '--model gpt-5.5' } }
    })

    expect(result.ok && result.commandLabel).toBe('codex')
  })
})
