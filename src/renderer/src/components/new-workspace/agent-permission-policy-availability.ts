import { CLIENT_PLATFORM } from '@/lib/new-workspace'
import type { AgentPermissionPolicy } from '../../../../shared/agent-permission-policy'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { resolvedTuiAgentArgsBypassPermissions } from '../../../../shared/tui-agent-launch-defaults'

// Agents that launch the `claude` CLI, whose bypass mode still raises the removal safety prompt.
const CLAUDE_CLI_AGENTS: ReadonlySet<TuiAgent> = new Set([
  'claude',
  'claude-agent-teams',
  'claude-api',
  'claude-api-agent-teams',
  'deepseek',
  'deepseek-agent-teams'
])

export type AgentPermissionPolicyAvailabilityInput = {
  agent: TuiAgent | null
  executionHostId: string | null | undefined
  settings:
    | Pick<
        GlobalSettings,
        'agentDefaultArgs' | 'terminalWindowsShell' | 'activeRuntimeEnvironmentId'
      >
    | null
    | undefined
}

/**
 * Whether the composer offers a permission policy: a Claude-CLI agent that launches in bypass on
 * this machine. SSH and paired runtimes are excluded: their launch args and hook are not local.
 */
export function isAgentPermissionPolicyAvailable(
  input: AgentPermissionPolicyAvailabilityInput
): boolean {
  if (
    !input.agent ||
    !CLAUDE_CLI_AGENTS.has(input.agent) ||
    !input.settings ||
    input.settings.activeRuntimeEnvironmentId?.trim() ||
    input.executionHostId !== LOCAL_EXECUTION_HOST_ID
  ) {
    return false
  }
  return resolvedTuiAgentArgsBypassPermissions(input.agent, input.settings, CLIENT_PLATFORM)
}

/** The policy to submit: only while the field would still be offered for the chosen agent. */
export function resolveSubmittedAgentPermissionPolicy(
  input: AgentPermissionPolicyAvailabilityInput & { value: AgentPermissionPolicy | null }
): AgentPermissionPolicy | undefined {
  return input.value && isAgentPermissionPolicyAvailable(input) ? input.value : undefined
}
