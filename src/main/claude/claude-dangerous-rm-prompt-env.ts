import { addWslEnvKeys } from '../../shared/wsl-env'

// Why: without it Claude auto-denies its bypass-mode dangerous-rm prompt after 2:00, and after
// three unanswered prompts denies later ones unseen. Measured on claude 2.1.323.
export const CLAUDE_DANGEROUS_RM_NO_TIMEOUT_ENV = 'CLAUDE_CODE_DISABLE_DANGEROUS_RM_TIMEOUT'

type Env = Record<string, string | undefined>

/** The value a Claude process should get: the user's own (launch env, then this process), else 1.
 *  Always explicit, because SSH hosts and teammate panes do not inherit this process's env. */
export function resolveClaudeDangerousRmNoTimeoutValue(
  launchEnv: Env | undefined,
  inheritedEnv: Env = process.env
): string {
  return (
    launchEnv?.[CLAUDE_DANGEROUS_RM_NO_TIMEOUT_ENV] ??
    inheritedEnv[CLAUDE_DANGEROUS_RM_NO_TIMEOUT_ENV] ??
    '1'
  )
}

/** wsl.exe drops custom Windows env vars unless WSLENV names them. */
export function forwardClaudeDangerousRmEnvToWsl(env: Env): void {
  if (env[CLAUDE_DANGEROUS_RM_NO_TIMEOUT_ENV] !== undefined) {
    addWslEnvKeys(env, [CLAUDE_DANGEROUS_RM_NO_TIMEOUT_ENV])
  }
}
