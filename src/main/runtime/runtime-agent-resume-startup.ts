import {
  isResumableTuiAgent,
  normalizeAgentProviderSession,
  type AgentProviderSessionMetadata,
  type ResumableTuiAgent,
  type SleepingAgentLaunchConfig,
  type SleepingAgentSessionRecord
} from '../../shared/agent-session-resume'
import { agentResumeOriginNamesAnotherExecutionHost } from '../../shared/agent-resume-execution-host-scope'
import {
  resolveAgentStartupPlanInputs,
  type AgentStartupSettings
} from '../../shared/agent-startup-plan-inputs'
import { LOCAL_EXECUTION_HOST_ID, toSshExecutionHostId } from '../../shared/execution-host'
import type { SessionOptionValue } from '../../shared/native-chat-session-options'
import { parseLegacyNumericPaneKey } from '../../shared/stable-pane-id'
import { isTuiAgentEnabled } from '../../shared/tui-agent-selection'
import { buildAgentResumeStartupPlan, type AgentStartupPlan } from '../../shared/tui-agent-startup'
import type { WorkspaceSessionState } from '../../shared/workspace-session-state-types'
import { runtimeWorktreeIdsEqual } from './runtime-worktree-path-identity'

/** The host-side `--resume` plan; a sleeping record's launchConfig replays its exact args/env/command. */
export function buildRuntimeAgentResumeStartupPlan(args: {
  agent: ResumableTuiAgent
  providerSession: AgentProviderSessionMetadata
  settings: AgentStartupSettings
  platform: NodeJS.Platform
  isRemote: boolean
  launchConfig?: SleepingAgentLaunchConfig
  agentArgs?: string | null
  ompResumeFilePath?: string | null
  sessionOptions?: Record<string, SessionOptionValue>
  sessionOptionsOverrideAgentArgs?: boolean
}): AgentStartupPlan | null {
  const { launchConfig } = args
  const inputs = resolveAgentStartupPlanInputs({
    agent: args.agent,
    settings: args.settings,
    platform: args.platform,
    isRemote: args.isRemote,
    agentArgs: launchConfig ? launchConfig.agentArgs : args.agentArgs,
    sessionOptions: args.sessionOptions
  })
  return buildAgentResumeStartupPlan({
    ...inputs,
    agent: args.agent,
    providerSession: args.providerSession,
    ...(launchConfig ? { agentEnv: launchConfig.agentEnv } : {}),
    ...(launchConfig?.agentCommand ? { agentCommand: launchConfig.agentCommand } : {}),
    ompResumeFilePath: args.ompResumeFilePath ?? launchConfig?.ompResumeFilePath,
    sessionOptionsOverrideAgentArgs:
      args.sessionOptionsOverrideAgentArgs ?? inputs.sessionOptionsOverrideAgentArgs
  })
}

export type SleepingPaneMaterializeStartup =
  | { kind: 'no-record' }
  // Why: a record we cannot resume still owns the pane; a fresh launch there would bury its conversation.
  | { kind: 'plain-shell' }
  | {
      kind: 'resume'
      agent: ResumableTuiAgent
      providerSession: AgentProviderSessionMetadata
      plan: AgentStartupPlan
    }

/**
 * Legacy `tabId:<numeric pane>` records can't be mapped to a leaf without the renderer's pane ids,
 * so main only detects that one may belong to this tab and keeps the pane a shell.
 */
export function hasLegacySleepingRecordForTab(
  records: Record<string, SleepingAgentSessionRecord> | undefined,
  tabId: string | undefined,
  worktreeId: string
): boolean {
  if (!records || !tabId) {
    return false
  }
  return Object.entries(records).some(([paneKey, record]) => {
    const legacy = parseLegacyNumericPaneKey(paneKey)
    return (
      legacy?.tabId === tabId &&
      runtimeWorktreeIdsEqual(record.worktreeId, worktreeId) &&
      (!record.tabId || record.tabId === tabId)
    )
  })
}

/** Decides how a dead pane that may hold a sleeping agent record is materialized. */
export function resolveSleepingPaneMaterializeStartup(args: {
  record: SleepingAgentSessionRecord | undefined
  worktreeId: string
  workspaceConnectionId: string | null
  settings: AgentStartupSettings & { disabledTuiAgents?: readonly string[] }
  platform: NodeJS.Platform
}): SleepingPaneMaterializeStartup {
  const { record } = args
  if (!record || !runtimeWorktreeIdsEqual(record.worktreeId, args.worktreeId)) {
    return { kind: 'no-record' }
  }
  const providerSession = normalizeAgentProviderSession(record.providerSession)
  if (
    !isResumableTuiAgent(record.agent) ||
    !providerSession ||
    !isTuiAgentEnabled(record.agent, args.settings.disabledTuiAgents) ||
    agentResumeOriginNamesAnotherExecutionHost(
      record.connectionId,
      args.workspaceConnectionId
        ? toSshExecutionHostId(args.workspaceConnectionId)
        : LOCAL_EXECUTION_HOST_ID
    )
  ) {
    return { kind: 'plain-shell' }
  }
  const plan = buildRuntimeAgentResumeStartupPlan({
    agent: record.agent,
    providerSession,
    settings: args.settings,
    platform: args.platform,
    isRemote: Boolean(args.workspaceConnectionId),
    ...(record.launchConfig ? { launchConfig: record.launchConfig } : {})
  })
  return plan
    ? { kind: 'resume', agent: record.agent, providerSession, plan }
    : { kind: 'plain-shell' }
}

/** The session without `paneKey`'s sleeping record, or null when there is nothing to remove. */
export function omitSleepingRecord(
  session: WorkspaceSessionState | null,
  paneKey: string
): WorkspaceSessionState | null {
  if (!session?.sleepingAgentSessionsByPaneKey?.[paneKey]) {
    return null
  }
  const sleeping = { ...session.sleepingAgentSessionsByPaneKey }
  delete sleeping[paneKey]
  return { ...session, sleepingAgentSessionsByPaneKey: sleeping }
}
