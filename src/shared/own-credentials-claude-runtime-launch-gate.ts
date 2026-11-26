import {
  CLAUDE_API_PROVIDER_ENV_KEY,
  CLAUDE_API_PROVIDER_ENV_VALUE,
  isClaudeApiTuiAgent
} from './claude-api-provider'
import {
  DEEPSEEK_PROVIDER_ENV_KEY,
  DEEPSEEK_PROVIDER_ENV_VALUE,
  isDeepSeekTuiAgent
} from './deepseek-claude-provider'
import {
  AGENT_SESSION_DEEPSEEK_RESUME_RUNTIME_CAPABILITY,
  DEEPSEEK_HOST_UPDATE_REQUIRED_MESSAGE
} from './protocol-version'
import {
  CLAUDE_API_AGENT_RUNTIME_CAPABILITY,
  CLAUDE_API_HOST_UPDATE_REQUIRED_MESSAGE
} from './claude-api-runtime-capability'
import type { RuntimeRpcFailure, RuntimeRpcResponse } from './runtime-rpc-envelope'

export const DEEPSEEK_HOST_UPDATE_REQUIRED_CODE = 'deepseek_host_update_required'
export const CLAUDE_API_HOST_UPDATE_REQUIRED_CODE = 'claude_api_host_update_required'

/** A provider that runs `claude` on its own credentials; an older host would run plain `claude`. */
type OwnCredentialsClaudeProvider = {
  isAgent: (agent: unknown) => boolean
  markerKey: string
  markerValue: string
  capability: string
  code: string
  message: string
}

const PROVIDERS: readonly OwnCredentialsClaudeProvider[] = [
  {
    isAgent: isDeepSeekTuiAgent,
    markerKey: DEEPSEEK_PROVIDER_ENV_KEY,
    markerValue: DEEPSEEK_PROVIDER_ENV_VALUE,
    capability: AGENT_SESSION_DEEPSEEK_RESUME_RUNTIME_CAPABILITY,
    code: DEEPSEEK_HOST_UPDATE_REQUIRED_CODE,
    message: DEEPSEEK_HOST_UPDATE_REQUIRED_MESSAGE
  },
  {
    isAgent: isClaudeApiTuiAgent,
    markerKey: CLAUDE_API_PROVIDER_ENV_KEY,
    markerValue: CLAUDE_API_PROVIDER_ENV_VALUE,
    capability: CLAUDE_API_AGENT_RUNTIME_CAPABILITY,
    code: CLAUDE_API_HOST_UPDATE_REQUIRED_CODE,
    message: CLAUDE_API_HOST_UPDATE_REQUIRED_MESSAGE
  }
]

// Every params field that names the agent a launch/create/resume/worker RPC will run.
const AGENT_IDENTITY_KEYS = ['launchAgent', 'agent', 'createdWithAgent', 'startupAgent'] as const
const NESTED_AGENT_KEYS = ['startupDraftPaste'] as const
const ENV_KEYS = ['env', 'startupEnv'] as const
const LAUNCH_CONFIG_KEYS = ['launchConfig', 'startupLaunchConfig'] as const

function readRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null
}

function paramsLaunchProvider(
  record: Record<string, unknown>,
  provider: OwnCredentialsClaudeProvider
): boolean {
  const hasMarker = (value: unknown): boolean =>
    readRecord(value)?.[provider.markerKey] === provider.markerValue
  return (
    AGENT_IDENTITY_KEYS.some((key) => provider.isAgent(record[key])) ||
    NESTED_AGENT_KEYS.some((key) => provider.isAgent(readRecord(record[key])?.agent)) ||
    ENV_KEYS.some((key) => hasMarker(record[key])) ||
    LAUNCH_CONFIG_KEYS.some((key) => hasMarker(readRecord(record[key])?.agentEnv))
  )
}

function findLaunchedProviders(params: unknown): OwnCredentialsClaudeProvider[] {
  const record = readRecord(params)
  return record ? PROVIDERS.filter((provider) => paramsLaunchProvider(record, provider)) : []
}

/**
 * The refusal message when `capabilities` lack support for `agent`, else null. Only agents that run
 * `claude` on their own credentials are gated; any other agent returns null.
 */
export function ownCredentialsClaudeAgentHostRefusal(
  agent: unknown,
  capabilities: unknown
): string | null {
  const provider = PROVIDERS.find((entry) => entry.isAgent(agent))
  if (!provider) {
    return null
  }
  return Array.isArray(capabilities) && capabilities.includes(provider.capability)
    ? null
    : provider.message
}

/** True when these runtime RPC params would start DeepSeek or the API-key agent on the host. */
export function runtimeParamsLaunchOwnCredentialsClaude(params: unknown): boolean {
  return findLaunchedProviders(params).length > 0
}

/**
 * Refuses a launch of an agent that runs `claude` on its own credentials (DeepSeek, the API-key
 * agent) to a runtime host that does not advertise support for it.
 * Why: an older host either rejects the agent id or, on worktree.create, silently drops it and
 * runs the plain `claude` startup command on the host's real Anthropic account.
 * `readStatus` runs only for such launches, so other calls pay nothing.
 */
export async function refuseOwnCredentialsClaudeLaunchWithoutHostSupport(args: {
  method: string
  params: unknown
  readStatus: () => Promise<RuntimeRpcResponse<unknown>>
}): Promise<RuntimeRpcFailure | null> {
  const launched = args.method === 'status.get' ? [] : findLaunchedProviders(args.params)
  if (launched.length === 0) {
    return null
  }
  const status = await args.readStatus()
  if (!status.ok) {
    return { ...status, id: args.method }
  }
  const capabilities = readRecord(status.result)?.capabilities
  const unsupported = launched.find(
    (provider) => !(Array.isArray(capabilities) && capabilities.includes(provider.capability))
  )
  if (!unsupported) {
    return null
  }
  return {
    id: args.method,
    ok: false,
    error: { code: unsupported.code, message: unsupported.message },
    _meta: { runtimeId: status._meta.runtimeId }
  }
}
