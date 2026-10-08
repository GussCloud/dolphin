/**
 * Opts a local Claude Code launch into the Dolphin Telegram channel by splicing
 * `--mcp-config=<file> --dangerously-load-development-channels=server:dolphin-telegram` after the
 * `claude` token. Anything this cannot do safely leaves the command untouched, which keeps the pane
 * on the terminal.send fallback.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { hasReachedAppVersion } from '../../shared/app-version'
import { SETUP_AGENT_SEQUENCE_STARTUP_COMMAND_ENV } from '../../shared/setup-agent-sequencing'
import { DOLPHIN_TELEGRAM_CHANNEL_SERVER_NAME } from './telegram-channel-protocol'

/** Claude Code relays permission prompts only to session-registered channels from this version on. */
export const CLAUDE_CHANNEL_MIN_VERSION = '2.1.234'

export const TELEGRAM_CHANNEL_ENTRY_FILE_NAME = 'telegram-channel-mcp-entry.js'

// Why so strict: main does not know which shell (posix, PowerShell, cmd) will parse the line, and
// these characters are literal in all of them, so the splice needs no quoting.
const SHELL_SAFE_ARG_RE = /^[A-Za-z0-9._:/-]+$/
const CLAUDE_EXECUTABLE_TOKEN_RE = /^(?:[A-Za-z0-9._:/\\-]*[/\\])?claude(?:\.exe|\.cmd)?$/i
const USER_CHANNEL_FLAG_RE =
  /(?:^|\s)--(?:channels|dangerously-load-development-channels)(?:\s|=|$)/

export type ClaudeChannelMcpConfig = {
  mcpServers: Record<
    string,
    { type: 'stdio'; command: string; args: string[]; env: Record<string, string> }
  >
}

export function buildClaudeChannelMcpConfig(args: {
  execPath: string
  entryPath: string
}): ClaudeChannelMcpConfig {
  return {
    mcpServers: {
      [DOLPHIN_TELEGRAM_CHANNEL_SERVER_NAME]: {
        type: 'stdio',
        command: args.execPath,
        args: [args.entryPath],
        // Why: Dolphin's own Electron binary is the only Node runtime guaranteed on this host.
        env: { ELECTRON_RUN_AS_NODE: '1' }
      }
    }
  }
}

/** The argument suffix, or null when the config path is not literal in every shell. */
export function buildClaudeChannelLaunchArgs(mcpConfigPath: string): string | null {
  const portablePath = mcpConfigPath.replace(/\\/g, '/')
  if (!SHELL_SAFE_ARG_RE.test(portablePath)) {
    return null
  }
  return `--mcp-config=${portablePath} --dangerously-load-development-channels=server:${DOLPHIN_TELEGRAM_CHANNEL_SERVER_NAME}`
}

/**
 * `=` forms because both flags are variadic: a space-separated value would swallow a following
 * positional prompt. Null when the command does not start with a bare `claude` token.
 */
export function spliceClaudeChannelArgs(command: string, launchArgs: string): string | null {
  const leading = /^\s*/.exec(command)?.[0] ?? ''
  const body = command.slice(leading.length)
  const firstEnd = body.search(/\s/)
  const first = firstEnd === -1 ? body : body.slice(0, firstEnd)
  if (!CLAUDE_EXECUTABLE_TOKEN_RE.test(first) || USER_CHANNEL_FLAG_RE.test(body)) {
    return null
  }
  const rest = firstEnd === -1 ? '' : body.slice(firstEnd)
  return `${leading}${first} ${launchArgs}${rest}`
}

export type ClaudeChannelLaunchTarget = {
  command: string | undefined
  env: Record<string, string> | undefined
  launchAgent: unknown
  connectionId: string | null | undefined
  isWsl: boolean
}

export type ClaudeChannelLaunchPolicy = {
  /** The argument suffix when channels are on and this host's Claude supports them, else null. */
  launchArgs(): string | null
}

let activePolicy: ClaudeChannelLaunchPolicy | null = null

export function setClaudeChannelLaunchPolicy(policy: ClaudeChannelLaunchPolicy | null): void {
  activePolicy = policy
}

/**
 * Applied at PTY spawn. SSH and WSL panes are skipped: the channel server is Dolphin's local
 * Electron binary and talks to main over 127.0.0.1, which neither can reach.
 */
export function applyClaudeChannelLaunch(
  target: ClaudeChannelLaunchTarget,
  policy: ClaudeChannelLaunchPolicy | null = activePolicy
): { command: string | undefined; env: Record<string, string> | undefined } {
  const unchanged = { command: target.command, env: target.env }
  if (target.launchAgent !== 'claude' || target.connectionId || target.isWsl || !policy) {
    return unchanged
  }
  const launchArgs = policy.launchArgs()
  if (!launchArgs) {
    return unchanged
  }
  const sequenced = target.env?.[SETUP_AGENT_SEQUENCE_STARTUP_COMMAND_ENV]
  if (target.env && sequenced) {
    // Why: the setup runner evals this env value, so the claude line lives here, not in command.
    const spliced = spliceClaudeChannelArgs(sequenced, launchArgs)
    return spliced
      ? {
          command: target.command,
          env: { ...target.env, [SETUP_AGENT_SEQUENCE_STARTUP_COMMAND_ENV]: spliced }
        }
      : unchanged
  }
  const spliced = target.command ? spliceClaudeChannelArgs(target.command, launchArgs) : null
  return spliced ? { command: spliced, env: target.env } : unchanged
}

/** Settings + version gate + materialized MCP config, cached so spawns stay synchronous. */
export function createClaudeChannelLaunchPolicy(deps: {
  isEnabled: () => boolean
  probeClaudeVersion: () => Promise<string | null>
  /** Writes the MCP config file and returns its path, or null on failure. */
  writeMcpConfig: () => string | null
  now?: () => number
  reprobeAfterMs?: number
}): ClaudeChannelLaunchPolicy & { refresh(): Promise<void> } {
  const now = deps.now ?? Date.now
  const reprobeAfterMs = deps.reprobeAfterMs ?? 10 * 60_000
  let supported = false
  let configArgs: string | null = null
  let probedAt: number | null = null
  let inFlight: Promise<void> | null = null
  const refresh = (): Promise<void> => {
    inFlight ??= (async () => {
      try {
        const version = await deps.probeClaudeVersion()
        supported = version !== null && hasReachedAppVersion(version, CLAUDE_CHANNEL_MIN_VERSION)
        const configPath = supported ? deps.writeMcpConfig() : null
        configArgs = configPath ? buildClaudeChannelLaunchArgs(configPath) : null
        if (configPath && !configArgs) {
          console.warn('[telegram-channel] MCP config path is not shell-safe; channel disabled')
        }
      } catch (error) {
        supported = false
        console.warn('[telegram-channel] Claude version probe failed', error)
      } finally {
        probedAt = now()
        inFlight = null
      }
    })()
    return inFlight
  }
  return {
    refresh,
    launchArgs() {
      if (!deps.isEnabled()) {
        return null
      }
      if (probedAt === null || now() - probedAt > reprobeAfterMs) {
        // Why not await: spawns are synchronous here; this launch uses the last verdict.
        void refresh()
      }
      return supported ? configArgs : null
    }
  }
}

/** Writes the config under `dir` (Dolphin userData) and returns its path, or null on failure. */
export function writeClaudeChannelMcpConfigFile(
  dir: string,
  config: ClaudeChannelMcpConfig
): string | null {
  const filePath = join(dir, 'claude-channel-mcp.json')
  try {
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      filePath,
      `${JSON.stringify(config, null, 2)}
`,
      { mode: 0o600 }
    )
    return filePath
  } catch (error) {
    console.warn('[telegram-channel] failed to write MCP config', error)
    return null
  }
}
