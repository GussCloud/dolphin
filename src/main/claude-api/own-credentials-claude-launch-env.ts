import {
  CLAUDE_API_CONFLICTING_ENV_KEYS,
  isClaudeApiProviderEnv,
  isClaudeApiTuiAgent
} from '../../shared/claude-api-provider'
import { isDeepSeekTuiAgent } from '../../shared/deepseek-claude-provider'
import type { GlobalSettings } from '../../shared/global-settings-types'
import { prepareDeepSeekLaunch } from '../deepseek/deepseek-config-home-setup'
import { isDeepSeekLaunchRequest } from '../deepseek/deepseek-launch-request'
import type { WorktreeLaunchLocation } from '../worktree-launch-owner'
import { prepareClaudeApiLaunch } from './claude-api-launch'

function isClaudeApiSpawn(
  launchAgent: unknown,
  env: Record<string, string | undefined> | undefined
): boolean {
  // Why agent first: the launch agent names the provider; the marker only stands in without one.
  if (isDeepSeekTuiAgent(launchAgent)) {
    return false
  }
  return isClaudeApiTuiAgent(launchAgent) || isClaudeApiProviderEnv(env)
}

/**
 * The provider env of a spawn that runs `claude` on credentials Dolphin injects (DeepSeek, an API
 * account); null for every other spawn. Throws the provider's user-facing refusal.
 */
export async function prepareOwnCredentialsClaudeLaunch(args: {
  launchAgent: unknown
  env: Record<string, string | undefined> | undefined
  command: string | undefined
  connectionId: string | null | undefined
  target: { runtime?: 'host' | 'wsl'; wslDistro?: string | null }
  settings: GlobalSettings | undefined
  launch: WorktreeLaunchLocation
}): Promise<Record<string, string> | null> {
  if (isClaudeApiSpawn(args.launchAgent, args.env)) {
    return prepareClaudeApiLaunch({
      connectionId: args.connectionId,
      target: args.target,
      settings: args.settings,
      launchEnv: args.env,
      command: args.command,
      launch: args.launch
    })
  }
  if (isDeepSeekLaunchRequest({ launchAgent: args.launchAgent, env: args.env })) {
    return prepareDeepSeekLaunch({
      connectionId: args.connectionId,
      target: args.target,
      settings: args.settings,
      launchEnv: args.env
    })
  }
  return null
}

/** Env an API-key spawn must not inherit: it would route the CLI to another credential or endpoint. */
export function ownCredentialsClaudeEnvToDelete(
  patch: Record<string, string> | null
): readonly string[] {
  return patch && isClaudeApiProviderEnv(patch) ? CLAUDE_API_CONFLICTING_ENV_KEYS : []
}

/** Deletions that must never remove what the provider env just set (its key, its profile dir). */
export function keepOwnCredentialsClaudeEnv(
  envToDelete: string[] | undefined,
  patch: Record<string, string> | null
): string[] | undefined {
  if (!envToDelete || !patch || !isClaudeApiProviderEnv(patch)) {
    return envToDelete
  }
  const kept = new Set(Object.keys(patch).map((key) => key.toUpperCase()))
  return envToDelete.filter((key) => !kept.has(key.toUpperCase()))
}
