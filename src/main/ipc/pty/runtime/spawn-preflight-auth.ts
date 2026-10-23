import { overlayPlatformEnv } from '../../../../shared/platform-env-overlay'
import { isClaudeAuthSwitchInProgress } from '../../../claude-accounts/live-pty-gate'
import {
  CLAUDE_AUTH_ENV_CONFLICT_MESSAGE,
  CLAUDE_AUTH_SWITCH_IN_PROGRESS_MESSAGE,
  hasClaudeAuthEnvConflict
} from '../../../claude-accounts/environment'
import { prepareDeepSeekLaunch } from '../../../deepseek/deepseek-config-home-setup'
import { isDeepSeekLaunchRequest } from '../../../deepseek/deepseek-launch-request'
import { isManagedClaudeAuthLaunch } from '../host-env/fresh-spawn-routing'
import type { RuntimePtySpawnState } from './spawn-state'

/** Classifies the spawn for the managed Claude account gate; refuses it mid account switch. */
export function classifyRuntimeSpawnClaudeLaunch(ctx: RuntimePtySpawnState): void {
  const args = ctx.args
  ctx.isClaudeLaunch = isManagedClaudeAuthLaunch({
    command: args.command,
    launchAgent: args.launchAgent,
    env: args.env,
    connectionId: args.connectionId,
    preAdoptedStablePane: Boolean(ctx.preAdoptedStablePane)
  })
  if (ctx.isClaudeLaunch && isClaudeAuthSwitchInProgress()) {
    throw new Error(CLAUDE_AUTH_SWITCH_IN_PROGRESS_MESSAGE)
  }
}

/** Resolves the managed Claude auth patch, or the DeepSeek provider env, for this spawn. */
export async function prepareRuntimeSpawnAuth(ctx: RuntimePtySpawnState): Promise<void> {
  const args = ctx.args
  ctx.claudeAuth =
    ctx.isClaudeLaunch && ctx.deps.prepareClaudeAuth
      ? await ctx.deps.prepareClaudeAuth(ctx.codexSelectionTarget)
      : null
  if (ctx.isClaudeLaunch && isClaudeAuthSwitchInProgress()) {
    throw new Error(CLAUDE_AUTH_SWITCH_IN_PROGRESS_MESSAGE)
  }
  if (ctx.claudeAuth?.stripAuthEnv && hasClaudeAuthEnvConflict(args.env)) {
    throw new Error(CLAUDE_AUTH_ENV_CONFLICT_MESSAGE)
  }
  ctx.deepSeekEnvPatch =
    !ctx.preAdoptedStablePane &&
    isDeepSeekLaunchRequest({ launchAgent: args.launchAgent, env: args.env })
      ? await prepareDeepSeekLaunch({
          connectionId: args.connectionId,
          target: ctx.codexSelectionTarget,
          settings: ctx.deps.getSettings?.()
        })
      : null
}

export function applyRuntimeSpawnAuthEnv(
  ctx: RuntimePtySpawnState,
  env: Record<string, string> | undefined
): Record<string, string> | undefined {
  if (ctx.claudeAuth) {
    return { ...env, ...ctx.claudeAuth.envPatch }
  }
  return ctx.deepSeekEnvPatch ? overlayPlatformEnv(env ?? {}, ctx.deepSeekEnvPatch) : env
}
