import { dirname } from 'node:path'
import type { GlobalSettings } from '../../shared/global-settings-types'
import { ClaudeHookService } from '../claude/hook-service'
import { DEEPSEEK_HOOK_SETTINGS } from '../claude/hook-settings'
import { probeLocalClaudeVersion } from '../claude/local-claude-version'
import { createManagedHookLocalFilesystem } from '../agent-hooks/managed-hook-local-filesystem'
import { getRememberedWslClaudeVersion } from '../agent-hooks/wsl-claude-version-cache'
import type { DeepSeekConfigHome } from './deepseek-launch-env'

// Why not 'claude': the agent only gates Claude-only extras (statusline usage feed, Devin/Grok import
// guards) and labels a status that stays inside this module, since DeepSeek installs at launch rather
// than through the detection-driven hook target registry. Version-gated events (SessionEnd) follow
// DEEPSEEK_HOOK_SETTINGS.claudeVersionGatedEvents instead.
export const deepSeekHookService = new ClaudeHookService({
  agent: 'openclaude',
  displayName: 'DeepSeek',
  settings: DEEPSEEK_HOOK_SETTINGS
})

export type DeepSeekHookInstallDeps = {
  service: Pick<ClaudeHookService, 'install' | 'installRemote'>
  hostClaudeVersion: () => Promise<string | null>
  wslClaudeVersion: (distro: string) => string | null
}

let hostClaudeVersion: Promise<string | null> | null = null

function defaultDeps(
  settings: Partial<Pick<GlobalSettings, 'agentCmdOverrides'>> | undefined
): DeepSeekHookInstallDeps {
  return {
    service: deepSeekHookService,
    // Why once: `claude --version` costs a process spawn, and the binary does not change under us.
    hostClaudeVersion: () => (hostClaudeVersion ??= probeLocalClaudeVersion(settings)),
    wslClaudeVersion: getRememberedWslClaudeVersion
  }
}

// Why per process and version: the first launch rewrites script + settings, which picks up a script
// changed by an app update; a newly learned claude version re-installs so SessionEnd is added.
const installedHomes = new Set<string>()

/** Installs the managed status hooks into the DeepSeek config home a launch is about to use. */
export async function installDeepSeekHooks(
  configHome: DeepSeekConfigHome,
  settings?: Partial<Pick<GlobalSettings, 'agentCmdOverrides'>>,
  deps: DeepSeekHookInstallDeps = defaultDeps(settings)
): Promise<void> {
  const claudeVersion =
    configHome.wslDistro === null
      ? await deps.hostClaudeVersion()
      : deps.wslClaudeVersion(configHome.wslDistro)
  const key = `${configHome.wslDistro === null ? 'host' : `wsl:${configHome.wslDistro}`}@${claudeVersion ?? ''}`
  if (installedHomes.has(key)) {
    return
  }
  const options = claudeVersion ? { claudeVersion } : {}
  // Why the POSIX installer for WSL: Claude runs inside the distro and reads $HOME-relative hooks.
  const status =
    configHome.wslDistro === null
      ? deps.service.install(options)
      : await deps.service.installRemote(
          createManagedHookLocalFilesystem(),
          dirname(configHome.hostConfigDir),
          options
        )
  if (status.state === 'installed') {
    installedHomes.add(key)
    return
  }
  // Not memoized, so the next DeepSeek launch retries; this one starts without status hooks.
  console.warn(`[deepseek] managed hooks not installed (${status.state}): ${status.detail ?? ''}`)
}
