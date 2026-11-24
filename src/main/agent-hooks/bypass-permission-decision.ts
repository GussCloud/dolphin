// Answers Claude's bypass-mode permission prompt from the workspace policy, or leaves it to the user.
import type {
  AgentPermissionPolicy,
  BypassRemovalCategory
} from '../../shared/agent-permission-policy'
import type { AgentHookSource } from '../../shared/agent-hook-relay'
import {
  analyzeBypassRemoval,
  type BypassRemovalDiskCheck
} from '../../shared/bypass-removal-classifier'

export type BypassPermissionApproval = {
  toolName: string
  command: string
  /** Null under approve-all, which needs no classification. */
  categories: BypassRemovalCategory[] | null
  policyMode: AgentPermissionPolicy['mode']
  /** Paths main must confirm with realpath before the approval stands. */
  diskChecks: BypassRemovalDiskCheck[]
  cwd: string
}

/** Hook stdout that makes Claude allow the request without showing its prompt. */
export const BYPASS_PERMISSION_ALLOW_REPLY = JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PermissionRequest',
    decision: { behavior: 'allow' }
  }
})

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key]
  return typeof value === 'string' ? value : null
}

/**
 * The approval for this hook payload, or null to keep today's behavior (the user answers).
 * DeepSeek runs the Claude CLI with the same managed script, so it posts as `claude` too.
 */
export function decideBypassPermission(args: {
  source: AgentHookSource
  payload: unknown
  policy: AgentPermissionPolicy | null
  homeDir?: string
}): BypassPermissionApproval | null {
  const { payload, policy } = args
  // Why: the hook route, not the agent; DeepSeek's managed script also posts to /hook/claude.
  if (args.source !== 'claude' || !policy || typeof payload !== 'object' || payload === null) {
    return null
  }
  const record: Record<string, unknown> = { ...payload }
  if (
    record.hook_event_name !== 'PermissionRequest' ||
    record.permission_mode !== 'bypassPermissions'
  ) {
    return null
  }
  const toolName = readString(record, 'tool_name') ?? ''
  const toolInput = record.tool_input
  const command =
    typeof toolInput === 'object' && toolInput !== null && 'command' in toolInput
      ? toolInput.command
      : null
  const commandText = typeof command === 'string' ? command : ''
  // Why Bash only, even under approve-all: bypass mode prompts only for the removal check.
  if (toolName !== 'Bash' || !commandText) {
    return null
  }
  const cwd = readString(record, 'cwd') ?? ''
  if (policy.mode === 'approve-all') {
    return {
      toolName,
      command: commandText,
      categories: null,
      policyMode: policy.mode,
      diskChecks: [],
      cwd
    }
  }
  if (!cwd) {
    return null
  }
  const analysis = analyzeBypassRemoval(commandText, cwd, { homeDir: args.homeDir })
  if (!analysis || !analysis.categories.every((category) => policy.categories.includes(category))) {
    return null
  }
  return {
    toolName,
    command: commandText,
    categories: analysis.categories,
    policyMode: policy.mode,
    diskChecks: analysis.diskChecks,
    cwd
  }
}
