import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { GlobalSettings } from '../../shared/global-settings-types'
import { isAgentStatusHooksEnabled } from '../agent-hooks/managed-agent-hook-controls'
import { installDeepSeekHooks } from './deepseek-hook-service'
import {
  resolveDeepSeekLaunchEnv,
  type DeepSeekConfigHome,
  type DeepSeekLaunchTarget
} from './deepseek-launch-env'

const CLAUDE_STATE_FILE_NAME = '.claude.json'

/**
 * Marks Claude Code's first-run onboarding done in the DeepSeek config home. Verified with
 * claude 2.1.309: a fresh CLAUDE_CONFIG_DIR opens the theme picker, which would swallow the
 * prompt Dolphin types after start. The per-folder trust dialog is left to the user outside
 * autonomous goals (see autonomous-goal-claude-trust.ts).
 */
export function seedDeepSeekClaudeOnboarding(configDir: string): void {
  mkdirSync(configDir, { recursive: true })
  try {
    // Why 'wx': Claude owns an existing file (and a concurrent spawn may have just written one).
    writeFileSync(
      join(configDir, CLAUDE_STATE_FILE_NAME),
      `${JSON.stringify({ hasCompletedOnboarding: true }, null, 2)}\n`,
      { flag: 'wx' }
    )
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) {
      throw error
    }
  }
}

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
