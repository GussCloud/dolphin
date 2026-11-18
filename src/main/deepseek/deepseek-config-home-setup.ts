import type { GlobalSettings } from '../../shared/global-settings-types'
import { isAgentStatusHooksEnabled } from '../agent-hooks/managed-agent-hook-controls'
import { installDeepSeekHooks } from './deepseek-hook-service'
import {
  CLAUDE_STATE_FILE_NAME,
  seedDeepSeekClaudeOnboarding
} from './deepseek-claude-onboarding-seed'
import { runWslProcess } from '../wsl/wsl-runner'
import { isClaudeAutoCompactDisabledEnv } from '../../shared/autonomous-coordinator-launch-env'
import {
  resolveDeepSeekLaunchEnv,
  type DeepSeekConfigHome,
  type DeepSeekLaunchTarget
} from './deepseek-launch-env'

type DeepSeekLaunchSettings = Partial<
  Pick<GlobalSettings, 'deepseekModelSlots' | 'agentStatusHooksEnabled' | 'agentCmdOverrides'>
>

// Why: a file made through \\wsl.localhost gets the guest's default 0644 whatever mode Windows
// asks for, and Claude later keeps account state in it; only the guest can narrow its bits.
async function restrictWslGuestClaudeState(distro: string, linuxConfigDir: string): Promise<void> {
  const result = await runWslProcess({
    distro,
    loginPath: 'none',
    program: 'chmod',
    args: ['600', '--', `${linuxConfigDir.replace(/\/$/, '')}/${CLAUDE_STATE_FILE_NAME}`]
  })
  if (result.code !== 0) {
    throw new Error(`could not restrict the WSL guest's Claude state file: ${result.stderr.trim()}`)
  }
}

async function prepareDeepSeekConfigHome(
  configHome: DeepSeekConfigHome,
  settings: DeepSeekLaunchSettings | undefined
): Promise<void> {
  // Why best-effort: a missing seed or hook degrades the first run or status, not the launch.
  try {
    if (seedDeepSeekClaudeOnboarding(configHome.hostConfigDir) && configHome.wslDistro) {
      await restrictWslGuestClaudeState(configHome.wslDistro, configHome.processConfigDir)
    }
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
  /** The pane's own launch env; a goal coordinator's disables auto-compaction. */
  launchEnv?: Record<string, string | undefined>
}): Promise<Record<string, string>> {
  const { env, configHome } = resolveDeepSeekLaunchEnv({
    connectionId: args.connectionId,
    target: args.target,
    modelSlots: args.settings?.deepseekModelSlots,
    // Why: the overlay would otherwise re-add a compact window the coordinator never uses.
    ...(isClaudeAutoCompactDisabledEnv(args.launchEnv) ? { autoCompact: false } : {})
  })
  await prepareDeepSeekConfigHome(configHome, args.settings)
  return env
}
