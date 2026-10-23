import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  buildDeepSeekClaudeEnv,
  DEEPSEEK_CLAUDE_CONFIG_DIR_NAME,
  normalizeDeepSeekModelSlots
} from '../../shared/deepseek-claude-provider'
import { parseWslUncPath } from '../../shared/wsl-paths'
import { getDefaultWslDistro, getWslHome } from '../wsl'
import { readDeepSeekApiKey } from './deepseek-api-key-store'

export const DEEPSEEK_MISSING_API_KEY_MESSAGE =
  'DeepSeek has no API key. Add one in Settings > Agents > DeepSeek, then start the agent again.'
export const DEEPSEEK_UNREADABLE_API_KEY_MESSAGE =
  'The saved DeepSeek API key could not be read. Save it again in Settings > Agents > DeepSeek.'
export const DEEPSEEK_SSH_UNSUPPORTED_MESSAGE =
  'DeepSeek can only start on this computer or in WSL, not on an SSH host.'
export const DEEPSEEK_WSL_HOME_MESSAGE =
  'DeepSeek could not find your WSL home folder. Open a WSL terminal once, then try again.'

export type DeepSeekLaunchTarget = { runtime?: 'host' | 'wsl'; wslDistro?: string | null }

/** Where the DeepSeek Claude config dir lives, as the launching process and as this host see it. */
export type DeepSeekConfigHome = {
  /** Path the Claude process gets as CLAUDE_CONFIG_DIR (Linux path inside WSL). */
  processConfigDir: string
  /** The same directory as Dolphin's main process can write it (UNC path for WSL). */
  hostConfigDir: string
  wslDistro: string | null
}

export type DeepSeekLaunchEnvDeps = {
  readApiKey: () => string | null
  homeDir: () => string
  resolveWslHome: (distro: string) => string | null
  defaultWslDistro: () => string | null
}

const defaultDeps: DeepSeekLaunchEnvDeps = {
  readApiKey: readDeepSeekApiKey,
  homeDir: homedir,
  resolveWslHome: getWslHome,
  defaultWslDistro: getDefaultWslDistro
}

export function resolveDeepSeekConfigHome(
  target: DeepSeekLaunchTarget,
  deps: Pick<DeepSeekLaunchEnvDeps, 'homeDir' | 'resolveWslHome' | 'defaultWslDistro'> = defaultDeps
): DeepSeekConfigHome {
  if (target.runtime !== 'wsl') {
    const configDir = join(deps.homeDir(), DEEPSEEK_CLAUDE_CONFIG_DIR_NAME)
    return { processConfigDir: configDir, hostConfigDir: configDir, wslDistro: null }
  }
  const distro = target.wslDistro ?? deps.defaultWslDistro()
  const uncHome = distro ? deps.resolveWslHome(distro) : null
  const linuxHome = uncHome ? parseWslUncPath(uncHome)?.linuxPath : null
  if (!distro || !uncHome || !linuxHome) {
    throw new Error(DEEPSEEK_WSL_HOME_MESSAGE)
  }
  return {
    processConfigDir: `${linuxHome.replace(/\/$/, '')}/${DEEPSEEK_CLAUDE_CONFIG_DIR_NAME}`,
    hostConfigDir: join(uncHome, DEEPSEEK_CLAUDE_CONFIG_DIR_NAME),
    wslDistro: distro
  }
}

/** Throws a user-facing error when this launch cannot reach DeepSeek. */
export function resolveDeepSeekLaunchEnv(
  args: {
    connectionId: string | null | undefined
    target: DeepSeekLaunchTarget
    modelSlots: unknown
  },
  deps: DeepSeekLaunchEnvDeps = defaultDeps
): { env: Record<string, string>; configHome: DeepSeekConfigHome } {
  // Why: the key would have to cross the relay and the remote config home/hooks are unmanaged.
  if (args.connectionId) {
    throw new Error(DEEPSEEK_SSH_UNSUPPORTED_MESSAGE)
  }
  let apiKey: string | null
  try {
    apiKey = deps.readApiKey()
  } catch {
    throw new Error(DEEPSEEK_UNREADABLE_API_KEY_MESSAGE)
  }
  if (!apiKey) {
    throw new Error(DEEPSEEK_MISSING_API_KEY_MESSAGE)
  }
  const configHome = resolveDeepSeekConfigHome(args.target, deps)
  return {
    env: buildDeepSeekClaudeEnv({
      apiKey,
      slots: normalizeDeepSeekModelSlots(args.modelSlots),
      configDir: configHome.processConfigDir
    }),
    configHome
  }
}
