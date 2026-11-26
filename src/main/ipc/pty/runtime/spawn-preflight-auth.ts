import { overlayPlatformEnv } from '../../../../shared/platform-env-overlay'
import { isClaudeAuthSwitchInProgress } from '../../../claude-accounts/live-pty-gate'
import {
  CLAUDE_AUTH_ENV_CONFLICT_MESSAGE,
  CLAUDE_AUTH_SWITCH_IN_PROGRESS_MESSAGE,
  hasClaudeAuthEnvConflict
} from '../../../claude-accounts/environment'
import { prepareOwnCredentialsClaudeLaunch } from '../../../claude-api/own-credentials-claude-launch-env'
import { routeClaudeApiResumeEnv } from '../../../claude-api/claude-api-launch-request'
import { isManagedClaudeAuthLaunch } from '../host-env/fresh-spawn-routing'
import type { RuntimePtySpawnState } from './spawn-state'
import { readClaudeSpawnResumeSessionId } from '../../../claude-accounts/profile/claude-session-profile'

/** Classifies the spawn for the managed Claude account gate; refuses it mid account switch. */
export function classifyRuntimeSpawnClaudeLaunch(ctx: RuntimePtySpawnState): void {
  // Why before the gate reads the env: an API account's resume must carry its marker.
  ctx.args = {
    ...ctx.args,
    env: routeClaudeApiResumeEnv({
      launchAgent: ctx.args.launchAgent,
      env: ctx.args.env,
      command: ctx.args.command,
      connectionId: ctx.args.connectionId,
      settings: ctx.deps.getSettings?.()
    })
  }
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

/** Resolves the managed Claude auth patch, or the DeepSeek or API-key provider env, for this spawn. */
export async function prepareRuntimeSpawnAuth(ctx: RuntimePtySpawnState): Promise<void> {
  const args = ctx.args
  ctx.claudeAuth =
    ctx.isClaudeLaunch && ctx.deps.prepareClaudeAuth
      ? await ctx.deps.prepareClaudeAuth(ctx.codexSelectionTarget, {
          worktreeId: args.worktreeId,
          workspacePath: ctx.cwd,
          resumeSessionId: readClaudeSpawnResumeSessionId(args.command)
        })
      : null
  if (ctx.isClaudeLaunch && isClaudeAuthSwitchInProgress()) {
    throw new Error(CLAUDE_AUTH_SWITCH_IN_PROGRESS_MESSAGE)
  }
  if (ctx.claudeAuth?.stripAuthEnv && hasClaudeAuthEnvConflict(args.env)) {
    throw new Error(CLAUDE_AUTH_ENV_CONFLICT_MESSAGE)
  }
  ctx.ownCredentialsEnvPatch = ctx.preAdoptedStablePane
    ? null
    : await prepareOwnCredentialsClaudeLaunch({
        launchAgent: args.launchAgent,
        env: args.env,
        command: args.command,
        connectionId: args.connectionId,
        target: ctx.codexSelectionTarget,
        settings: ctx.deps.getSettings?.(),
        launch: { worktreeId: args.worktreeId, workspacePath: ctx.cwd }
      })
}

export function applyRuntimeSpawnAuthEnv(
  ctx: RuntimePtySpawnState,
  env: Record<string, string> | undefined
): Record<string, string> | undefined {
  if (ctx.claudeAuth) {
    return { ...env, ...ctx.claudeAuth.envPatch }
  }
  return ctx.ownCredentialsEnvPatch
    ? overlayPlatformEnv(env ?? {}, ctx.ownCredentialsEnvPatch)
    : env
}
