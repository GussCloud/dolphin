import { CLAUDE_API_CONFLICTING_ENV_KEYS } from '../../shared/claude-api-provider'
import { deletePlatformEnvKeys } from '../../shared/platform-env-key-deletion'
import type { WorktreeLaunchLocation } from '../worktree-launch-owner'

export type ClaudeApiCommitMessageTarget = { runtime?: 'host' | 'wsl'; wslDistro?: string | null }

/** The API account's env for a generation in `launch`; throws a user-facing refusal. */
export type PrepareForClaudeApiLaunch = (
  target: ClaudeApiCommitMessageTarget | undefined,
  launch: WorktreeLaunchLocation | undefined
) => Promise<Record<string, string>>

/**
 * The process env for a `claude -p` billed to an API account. Inherited auth that would send the
 * CLI to another login or endpoint is removed before the account's own env is laid over it.
 */
export async function prepareClaudeApiCommitMessageEnv(args: {
  prepare: PrepareForClaudeApiLaunch | undefined
  baseEnv: Record<string, string>
  target: ClaudeApiCommitMessageTarget | undefined
  launch: WorktreeLaunchLocation | undefined
}): Promise<{ ok: true; env: NodeJS.ProcessEnv } | { ok: false; error: string }> {
  // Why refuse: without the account service, the plain `claude` would answer on the plan login.
  if (!args.prepare) {
    return { ok: false, error: 'Claude API text generation is not available in this process.' }
  }
  try {
    const accountEnv = await args.prepare(args.target, args.launch)
    const env = { ...args.baseEnv }
    deletePlatformEnvKeys(env, CLAUDE_API_CONFLICTING_ENV_KEYS)
    return { ok: true, env: { ...env, ...accountEnv } }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
