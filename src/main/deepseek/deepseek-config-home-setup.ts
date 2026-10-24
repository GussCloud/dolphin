import type { GlobalSettings } from '../../shared/global-settings-types'
import { isAgentStatusHooksEnabled } from '../agent-hooks/managed-agent-hook-controls'
import { installDeepSeekHooks } from './deepseek-hook-service'
import { seedDeepSeekClaudeOnboarding } from './deepseek-claude-onboarding-seed'
import {
  resolveDeepSeekLaunchEnv,
  type DeepSeekConfigHome,
  type DeepSeekLaunchTarget
} from './deepseek-launch-env'

type DeepSeekLaunchSettings = Partial<
  Pick<GlobalSettings, 'deepseekModelSlots' | 'agentStatusHooksEnabled' | 'agentCmdOverrides'>
>

async function prepareDeepSeekConfigHome(
  configHome: DeepSeekConfigHome,
  settings: DeepSeekLaunchSettings | undefined
): Promise<void> {
  // Why best-effort: a missing seed or hook degrades the first run or status, not the launch.
  try {
    seedDeepSeekClaudeOnboarding(configHome.hostConfigDir)
  } catch (error) {
    console.warn('[deepseek] failed to seed Claude onboarding state', error)
  }
  if (!isAgentStatusHooksEnabled(settings)) {
    return
  }
  try {
    await installDeepSeekHooks(configHome, settings)
  } catch (error) {
    console.warn('[deepseek] failed to install managed hooks', error)
  }
}

/** The env a DeepSeek launch needs, after its config home is ready. Throws user-facing errors. */
export async function prepareDeepSeekLaunch(args: {
  connectionId: string | null | undefined
  target: DeepSeekLaunchTarget
  settings: DeepSeekLaunchSettings | undefined
}): Promise<Record<string, string>> {
  const { env, configHome } = resolveDeepSeekLaunchEnv({
    connectionId: args.connectionId,
    target: args.target,
    modelSlots: args.settings?.deepseekModelSlots
  })
  await prepareDeepSeekConfigHome(configHome, args.settings)
  return env
}
