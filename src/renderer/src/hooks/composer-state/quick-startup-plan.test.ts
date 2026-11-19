import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/new-workspace', () => ({ CLIENT_PLATFORM: 'linux' }))

import { buildQuickComposerStartup } from './quick-startup-plan'
import { composerLaunchPolicy } from './composer-launch-override'
import { buildDesignLaunchPrompt } from '../../../../shared/design-agent-prompt'
import { TUI_AGENT_CONFIG } from '../../../../shared/tui-agent-config'
import type { TuiAgent } from '../../../../shared/tui-agent'

const base = {
  agent: 'claude' as const,
  prompt: 'goal prompt',
  draftPrompt: null,
  settings: null,
  repoConnectionId: null,
  platform: 'linux' as const,
  shell: null,
  isRemote: false,
  telemetrySource: undefined
}

describe('quick composer startup for a goal coordinator', () => {
  it('launches a local coordinator with auto-compaction off and keeps it on relaunch', () => {
    const { startupPlan, backendStartup } = buildQuickComposerStartup({
      ...base,
      autonomousCoordinator: true
    })
    expect(startupPlan?.env).toMatchObject({ DISABLE_AUTO_COMPACT: '1' })
    expect(startupPlan?.launchConfig?.agentEnv).toMatchObject({ DISABLE_AUTO_COMPACT: '1' })
    expect(backendStartup?.env).toMatchObject({ DISABLE_AUTO_COMPACT: '1' })
  })

  it('leaves auto-compaction on for ordinary launches, SSH and WSL coordinators', () => {
    for (const input of [
      base,
      { ...base, autonomousCoordinator: true, isRemote: true },
      { ...base, autonomousCoordinator: true, platform: 'win32' as const }
    ]) {
      expect(buildQuickComposerStartup(input).startupPlan?.env ?? {}).not.toHaveProperty(
        'DISABLE_AUTO_COMPACT'
      )
    }
  })

  it('launches a design agent with its argv prompt but without coordinator env', () => {
    const { coordinatorEnv } = composerLaunchPolicy({ kind: 'design', prompt: 'p' })
    const { startupPlan } = buildQuickComposerStartup({
      ...base,
      prompt: 'design prompt',
      autonomousCoordinator: coordinatorEnv
    })
    expect(startupPlan?.launchCommand).toContain('design prompt')
    expect(startupPlan?.env ?? {}).not.toHaveProperty('DISABLE_AUTO_COMPACT')
  })

  it('delivers the design prompt to every agent, at launch or as its follow-up', () => {
    const prompt = buildDesignLaunchPrompt('design-1')
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: TUI_AGENT_CONFIG is a Record<TuiAgent, ...>, so its keys are exactly the agents.
    for (const agent of Object.keys(TUI_AGENT_CONFIG) as TuiAgent[]) {
      const { startupPlan, backendStartup } = buildQuickComposerStartup({ ...base, agent, prompt })
      // Why the env: Hermes reads its startup query from an env var set on the launch command.
      const inLaunch =
        startupPlan?.launchCommand.includes('design start --id design-1') === true ||
        Object.values(backendStartup?.env ?? {}).includes(prompt)
      const delivered =
        startupPlan?.followupPrompt === prompt ||
        (inLaunch && backendStartup?.command === startupPlan?.launchCommand)
      expect({ agent, delivered }).toEqual({ agent, delivered: true })
    }
  })
})
