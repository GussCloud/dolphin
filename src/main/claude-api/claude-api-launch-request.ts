import {
  CLAUDE_API_ACCOUNT_ENV_KEY,
  CLAUDE_API_PROVIDER_ENV_KEY,
  CLAUDE_API_PROVIDER_ENV_VALUE,
  isClaudeApiProviderEnv,
  isClaudeApiTuiAgent
} from '../../shared/claude-api-provider'
import { isClaudeLaunchCommand } from '../ipc/pty/host-env/fresh-spawn-routing'
import type { ClaudeApiLaunchAccountSettings } from './claude-api-launch-account'
import { findClaudeApiResumeOwner } from './claude-api-launch'
import { isOwnCredentialsClaudeLaunchRequest } from './own-credentials-claude-launch-request'

type LaunchIdentity = {
  launchAgent: unknown
  env: Record<string, string | undefined> | undefined
}

/** A `claude-api` launch, or any pane carrying its marker (relaunches, resumes). */
export function isClaudeApiLaunchRequest(args: LaunchIdentity): boolean {
  return isClaudeApiTuiAgent(args.launchAgent) || isClaudeApiProviderEnv(args.env)
}

/**
 * The pane env of a plain `claude --resume <id>` whose transcript lives in an API account's
 * profile, marked so the spawn runs as `claude-api` on that account. Any other launch gets its
 * env back unchanged. Why: the CLI finds the session only in that profile, and resuming it on
 * the plan would both fail and bill the wrong login.
 */
export function routeClaudeApiResumeEnv(args: {
  launchAgent: unknown
  env: Record<string, string> | undefined
  command: string | undefined
  connectionId: string | null | undefined
  settings: ClaudeApiLaunchAccountSettings | undefined
}): Record<string, string> | undefined {
  if (
    args.connectionId ||
    isOwnCredentialsClaudeLaunchRequest(args) ||
    !isClaudeLaunchCommand(args.command)
  ) {
    return args.env
  }
  const owner = findClaudeApiResumeOwner(args.settings, args.command)
  if (!owner) {
    return args.env
  }
  return {
    ...args.env,
    [CLAUDE_API_PROVIDER_ENV_KEY]: CLAUDE_API_PROVIDER_ENV_VALUE,
    [CLAUDE_API_ACCOUNT_ENV_KEY]: owner.id
  }
}
