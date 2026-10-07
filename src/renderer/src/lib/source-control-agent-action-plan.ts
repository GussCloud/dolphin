import {
  buildAgentDraftLaunchPlan,
  buildAgentStartupPlan,
  planAgentCliArgsSuffix,
  type AgentStartupPlan
} from '@/lib/tui-agent-startup'
import { CLIENT_PLATFORM } from '@/lib/new-workspace'
import { TUI_AGENT_CONFIG } from '../../../shared/tui-agent-config'
import { isTuiAgentEnabled } from '../../../shared/tui-agent-selection'
import type { TuiAgent } from '../../../shared/tui-agent'
import { translate } from '@/i18n/i18n'
import {
  resolveAgentStartupPlanInputs,
  type AgentStartupSettings
} from '../../../shared/agent-startup-plan-inputs'
import type { SessionOptionValue } from '../../../shared/native-chat-session-options'

export type SourceControlLaunchPlanDelivery =
  | 'argv'
  | 'draft-native'
  | 'draft-paste'
  | 'paste-submit'

export type SourceControlLaunchPlanResult =
  | {
      ok: true
      plan: AgentStartupPlan
      delivery: SourceControlLaunchPlanDelivery
      commandLabel: string
      summary: string
      caveat: string
    }
  | { ok: false; error: string }

export function planSourceControlAgentActionLaunch(args: {
  agent: TuiAgent | null
  commandInput: string
  promptDelivery: 'auto-submit' | 'draft' | 'submit-after-ready'
  detectedAgents: TuiAgent[]
  disabledAgents?: TuiAgent[]
  /** Settings-derived inputs (default args/env, session instructions) the real launch applies. */
  settings?: AgentStartupSettings | null
  /** Omitted means the configured default args, matching the real launch. */
  agentArgs?: string | null
  sessionOptions?: Record<string, SessionOptionValue>
  platform?: NodeJS.Platform
  /** Why: SSH remotes deploy the CLI shim as plain `dolphin`, so the Linux-only
   * `dolphin-ide` rename must not be applied for remote launches. */
  isRemote?: boolean
}): SourceControlLaunchPlanResult {
  const agent = args.agent
  if (!agent) {
    return {
      ok: false,
      error: translate(
        'auto.lib.source.control.agent.action.plan.a7ac8717c7',
        'Choose an agent before starting.'
      )
    }
  }
  if (!isTuiAgentEnabled(agent, args.disabledAgents)) {
    return {
      ok: false,
      error: translate(
        'auto.lib.source.control.agent.action.plan.b96e091fc9',
        'The selected agent is disabled in Settings.'
      )
    }
  }
  if (!args.detectedAgents.includes(agent)) {
    return {
      ok: false,
      error: translate(
        'auto.lib.source.control.agent.action.plan.8eb541cc83',
        'The selected agent was not detected on this workspace host.'
      )
    }
  }

  const trimmedInput = args.commandInput.trim()
  if (!trimmedInput) {
    return {
      ok: false,
      error: translate(
        'auto.lib.source.control.agent.action.plan.46f1a2c9bd',
        'Command input is empty.'
      )
    }
  }

  const platform = args.platform ?? CLIENT_PLATFORM
  const inputs = resolveAgentStartupPlanInputs({
    agent,
    settings: args.settings ?? {},
    platform,
    isRemote: args.isRemote ?? false,
    ...(args.agentArgs !== undefined ? { agentArgs: args.agentArgs } : {}),
    sessionOptions: args.sessionOptions
  })
  const shell = inputs.shell ?? (platform === 'win32' ? 'powershell' : 'posix')
  const plannedArgs = planAgentCliArgsSuffix(inputs.agentArgs, shell)
  if (!plannedArgs.ok) {
    return { ok: false, error: plannedArgs.error }
  }
  const planInputs = { ...inputs, shell }
  let startupPlan: AgentStartupPlan | null = null
  let delivery: SourceControlLaunchPlanDelivery

  if (args.promptDelivery === 'submit-after-ready') {
    startupPlan = buildAgentStartupPlan({
      ...planInputs,
      prompt: '',
      allowEmptyPromptLaunch: true
    })
    delivery = 'paste-submit'
  } else if (args.promptDelivery === 'draft') {
    const draftLaunchPlan = buildAgentDraftLaunchPlan({
      ...planInputs,
      draft: trimmedInput
    })
    if (draftLaunchPlan) {
      startupPlan = {
        agent: draftLaunchPlan.agent,
        launchCommand: draftLaunchPlan.launchCommand,
        expectedProcess: draftLaunchPlan.expectedProcess,
        followupPrompt: null,
        launchConfig: draftLaunchPlan.launchConfig,
        ...(draftLaunchPlan.sessionOptions
          ? { sessionOptions: draftLaunchPlan.sessionOptions }
          : {}),
        ...(draftLaunchPlan.startupCommandDelivery
          ? { startupCommandDelivery: draftLaunchPlan.startupCommandDelivery }
          : {}),
        ...(draftLaunchPlan.env ? { env: draftLaunchPlan.env } : {})
      }
      delivery = 'draft-native'
    } else {
      startupPlan = buildAgentStartupPlan({
        ...planInputs,
        prompt: '',
        allowEmptyPromptLaunch: true
      })
      delivery = 'draft-paste'
    }
  } else if (TUI_AGENT_CONFIG[agent].promptInjectionMode === 'stdin-after-start') {
    startupPlan = buildAgentStartupPlan({
      ...planInputs,
      prompt: '',
      allowEmptyPromptLaunch: true
    })
    delivery = 'draft-paste'
  } else {
    startupPlan = buildAgentStartupPlan({
      ...planInputs,
      prompt: trimmedInput,
      allowEmptyPromptLaunch: false
    })
    delivery = 'argv'
  }

  if (!startupPlan) {
    return {
      ok: false,
      error: translate(
        'auto.lib.source.control.agent.action.plan.3f0ea9aa0d',
        'Could not build the agent launch command.'
      )
    }
  }

  const summary =
    delivery === 'paste-submit'
      ? 'The agent starts with no prompt, then Dolphin pastes and submits the command input after the TUI is ready.'
      : delivery === 'draft-native'
        ? 'The command input is prefilled as an editable draft by the agent launch command.'
        : delivery === 'draft-paste'
          ? 'The agent starts with no prompt, then Dolphin pastes the command input as an editable draft after the TUI is ready.'
          : 'The command input is included in the launch command and submitted as the first turn.'

  return {
    ok: true,
    plan: startupPlan,
    delivery,
    commandLabel: startupPlan.launchCommand,
    summary,
    caveat:
      'This check builds Dolphin’s launch plan only. PATH, binary availability, account setup, and terminal startup failures are still caught by the real launch watchdog.'
  }
}
