import type { GlobalSettings } from '../../../shared/global-settings-types'
import { isAgentStatusHooksEnabled } from '../../agent-hooks/managed-agent-hook-controls'
import { ClaudeHookService } from '../../claude/hook-service'
import { CLAUDE_HOOK_SETTINGS } from '../../claude/hook-settings'
import { probeLocalClaudeVersion } from '../../claude/local-claude-version'

type ProfileHookSettings = Partial<
  Pick<GlobalSettings, 'agentCmdOverrides' | 'agentStatusHooksEnabled'>
>

export type ClaudeProfileHookDeps = {
  createService: (profileDir: string) => Pick<ClaudeHookService, 'install'>
  hostClaudeVersion: () => Promise<string | null>
}

let hostClaudeVersion: Promise<string | null> | null = null

function defaultDeps(settings: ProfileHookSettings): ClaudeProfileHookDeps {
  return {
    // Why agent 'claude': a profile runs the real Claude CLI, so it keeps the status rules and the
    // usage statusline; only the settings file moves into the profile.
    createService: (profileDir) =>
      new ClaudeHookService({
        agent: 'claude',
        displayName: 'Claude',
        settings: { ...CLAUDE_HOOK_SETTINGS, configDirPath: profileDir }
      }),
    // Why once: `claude --version` costs a process spawn, and the binary does not change under us.
    hostClaudeVersion: () => (hostClaudeVersion ??= probeLocalClaudeVersion(settings))
  }
}

// Why per process, profile and version: the first launch rewrites script + settings, which picks
// up a script changed by an app update; a newly learned claude version re-installs SessionEnd.
const installedProfiles = new Set<string>()

/** Installs the managed status hooks and usage statusline into a profile about to launch. */
export async function installClaudeProfileHooks(
  profileDir: string,
  settings: ProfileHookSettings,
  deps: ClaudeProfileHookDeps = defaultDeps(settings)
): Promise<void> {
  // Why: the same switch that keeps hooks out of ~/.claude keeps them out of every profile.
  if (!isAgentStatusHooksEnabled(settings)) {
    return
  }
  const claudeVersion = await deps.hostClaudeVersion()
  const key = `${profileDir}@${claudeVersion ?? ''}`
  if (installedProfiles.has(key)) {
    return
  }
  const status = deps.createService(profileDir).install(claudeVersion ? { claudeVersion } : {})
  if (status.state === 'installed') {
    installedProfiles.add(key)
    return
  }
  // Not memoized, so the next launch retries; this one starts without status hooks.
  console.warn(
    `[claude-profile] managed hooks not installed (${status.state}): ${status.detail ?? ''}`
  )
}

export function resetClaudeProfileHookMemoForTests(): void {
  installedProfiles.clear()
  hostClaudeVersion = null
}
