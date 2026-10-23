import {
  DEEPSEEK_CLAUDE_ENV_KEYS,
  isDeepSeekProviderEnv
} from '../../shared/deepseek-claude-provider'
import { addWslEnvKeys } from '../../shared/wsl-env'

/** wsl.exe drops custom Windows env vars unless WSLENV names them; only DeepSeek panes carry these. */
export function forwardDeepSeekEnvToWsl(env: Record<string, string | undefined>): void {
  if (isDeepSeekProviderEnv(env)) {
    addWslEnvKeys(env, DEEPSEEK_CLAUDE_ENV_KEYS)
  }
}
