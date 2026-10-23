import {
  DEEPSEEK_PROVIDER_ENV_KEY,
  DEEPSEEK_PROVIDER_ENV_VALUE,
  isDeepSeekTuiAgent
} from './deepseek-claude-provider'
import {
  AGENT_SESSION_DEEPSEEK_RESUME_RUNTIME_CAPABILITY,
  DEEPSEEK_HOST_UPDATE_REQUIRED_MESSAGE
} from './protocol-version'
import type { RuntimeRpcFailure, RuntimeRpcResponse } from './runtime-rpc-envelope'

export const DEEPSEEK_HOST_UPDATE_REQUIRED_CODE = 'deepseek_host_update_required'

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

function hasProviderMarker(value: unknown): boolean {
  return readRecord(value)?.[DEEPSEEK_PROVIDER_ENV_KEY] === DEEPSEEK_PROVIDER_ENV_VALUE
}

/** True when a host status capability list says the host knows the DeepSeek agents. */
export function runtimeCapabilitiesSupportDeepSeek(capabilities: unknown): boolean {
  return (
    Array.isArray(capabilities) &&
    capabilities.includes(AGENT_SESSION_DEEPSEEK_RESUME_RUNTIME_CAPABILITY)
  )
}

/** True when these runtime RPC params would start a DeepSeek agent on the receiving host. */
export function runtimeParamsLaunchDeepSeek(params: unknown): boolean {
  const record = readRecord(params)
  if (!record) {
    return false
  }
  if (AGENT_IDENTITY_KEYS.some((key) => isDeepSeekTuiAgent(record[key]))) {
    return true
  }
  if (NESTED_AGENT_KEYS.some((key) => isDeepSeekTuiAgent(readRecord(record[key])?.agent))) {
    return true
  }
  if (ENV_KEYS.some((key) => hasProviderMarker(record[key]))) {
    return true
  }
  return LAUNCH_CONFIG_KEYS.some((key) => hasProviderMarker(readRecord(record[key])?.agentEnv))
}

/**
 * Refuses a DeepSeek launch to a runtime host that does not advertise DeepSeek support.
 * Why: an older host either rejects the agent id or, on worktree.create, silently drops it and
 * runs the plain `claude` startup command on the host's real Anthropic account.
 * `readStatus` runs only for DeepSeek launches, so other calls pay nothing.
 */
export async function refuseDeepSeekLaunchWithoutHostSupport(args: {
  method: string
  params: unknown
  readStatus: () => Promise<RuntimeRpcResponse<unknown>>
}): Promise<RuntimeRpcFailure | null> {
  if (args.method === 'status.get' || !runtimeParamsLaunchDeepSeek(args.params)) {
    return null
  }
  const status = await args.readStatus()
  if (!status.ok) {
    return { ...status, id: args.method }
  }
  if (runtimeCapabilitiesSupportDeepSeek(readRecord(status.result)?.capabilities)) {
    return null
  }
  return {
    id: args.method,
    ok: false,
    error: {
      code: DEEPSEEK_HOST_UPDATE_REQUIRED_CODE,
      message: DEEPSEEK_HOST_UPDATE_REQUIRED_MESSAGE
    },
    _meta: { runtimeId: status._meta.runtimeId }
  }
}
