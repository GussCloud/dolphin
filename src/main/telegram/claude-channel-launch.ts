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
import type { TelegramChannelAvailability } from '../../shared/telegram-bridge-state'
import { grantClaudeChannelPane } from './claude-channel-panes'
import { DOLPHIN_TELEGRAM_CHANNEL_SERVER_NAME } from './telegram-channel-protocol'

/** Claude Code relays permission prompts only to session-registered channels from this version on. */
export const CLAUDE_CHANNEL_MIN_VERSION = '2.1.234'

export const TELEGRAM_CHANNEL_ENTRY_FILE_NAME = 'telegram-channel-mcp-entry.js'

// Main does not know which shell (sh/bash/zsh/fish, PowerShell, cmd) parses the line, so the path
// must read the same in all of them: bare when every char is inert, else inside double quotes.
const BARE_SAFE_PATH_RE = /^[A-Za-z0-9._:/-]+$/
// Still live inside "…" in at least one of those shells (expansion, escapes, cmd carets).
const DOUBLE_QUOTE_UNSAFE_RE = /["$`%!^\\\p{Cc}]/u
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

/** The path as one shell word that is literal in every shell Dolphin types into, or null. */
export function shellLiteralConfigPath(path: string): string | null {
  const portable = path.replace(/\\/g, '/')
  if (BARE_SAFE_PATH_RE.test(portable)) {
    return portable
  }
  return DOUBLE_QUOTE_UNSAFE_RE.test(portable) ? null : `"${portable}"`
}

/** The argument suffix, or null when the config path cannot be written literally. */
export function buildClaudeChannelLaunchArgs(mcpConfigPath: string): string | null {
  const literal = shellLiteralConfigPath(mcpConfigPath)
  return literal
    ? `--mcp-config=${literal} --dangerously-load-development-channels=server:${DOLPHIN_TELEGRAM_CHANNEL_SERVER_NAME}`
    : null
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
    if (spliced) {
      grantClaudeChannelPane(target.env)
    }
    return spliced
      ? {
          command: target.command,
          env: { ...target.env, [SETUP_AGENT_SEQUENCE_STARTUP_COMMAND_ENV]: spliced }
        }
      : unchanged
  }
  const spliced = target.command ? spliceClaudeChannelArgs(target.command, launchArgs) : null
  if (spliced) {
    grantClaudeChannelPane(target.env)
  }
  return spliced ? { command: spliced, env: target.env } : unchanged
}

export type ClaudeChannelAvailability = TelegramChannelAvailability

export type ClaudeChannelLaunchPolicyHandle = ClaudeChannelLaunchPolicy & {
  refresh(): Promise<void>
  availability(): ClaudeChannelAvailability
  onAvailabilityChange(listener: () => void): () => void
}

type ProbedAvailability = Exclude<ClaudeChannelAvailability, 'off'>

/** Settings + version gate + materialized MCP config, cached so spawns stay synchronous. */
export function createClaudeChannelLaunchPolicy(deps: {
  isEnabled: () => boolean
  /** Null when no local `claude` was found. */
  probeClaudeVersion: () => Promise<string | null>
  /** Writes the MCP config where its path is shell-literal and returns the launch args, or null. */
  writeMcpConfig: () => string | null
  now?: () => number
  reprobeAfterMs?: number
}): ClaudeChannelLaunchPolicyHandle {
  const now = deps.now ?? Date.now
  const reprobeAfterMs = deps.reprobeAfterMs ?? 10 * 60_000
  let verdict: ProbedAvailability = 'checking'
  let configArgs: string | null = null
  let probedAt: number | null = null
  let inFlight: Promise<void> | null = null
  const listeners = new Set<() => void>()
  const settle = (next: ProbedAvailability): void => {
    if (next === verdict) {
      return
    }
    verdict = next
    for (const listener of listeners) {
      listener()
    }
  }
  const probe = async (): Promise<ProbedAvailability> => {
    const version = await deps.probeClaudeVersion()
    if (version === null) {
      return 'claude-not-found'
    }
    if (!hasReachedAppVersion(version, CLAUDE_CHANNEL_MIN_VERSION)) {
      return 'claude-too-old'
    }
    configArgs = deps.writeMcpConfig()
    return configArgs ? 'ready' : 'config-unavailable'
  }
  const refresh = (): Promise<void> => {
    inFlight ??= probe()
      .catch((error: unknown): ProbedAvailability => {
        console.warn('[telegram-channel] Claude version probe failed', error)
        return 'claude-not-found'
      })
      .then((next) => {
        probedAt = now()
        inFlight = null
        settle(next)
      })
    return inFlight
  }
  return {
    refresh,
    availability: () => (deps.isEnabled() ? verdict : 'off'),
    onAvailabilityChange(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    launchArgs() {
      if (!deps.isEnabled()) {
        return null
      }
      if (probedAt === null || now() - probedAt > reprobeAfterMs) {
        // Why not await: spawns are synchronous here; this launch uses the last verdict.
        void refresh()
      }
      return verdict === 'ready' ? configArgs : null
    }
  }
}

/**
 * Writes the config into the first candidate dir whose path can be typed literally and returns the
 * launch args, or null when none can (e.g. `%` or `$` in every candidate path).
 */
export function writeClaudeChannelMcpConfig(
  candidateDirs: readonly string[],
  config: ClaudeChannelMcpConfig
): string | null {
  for (const dir of candidateDirs) {
    const filePath = join(dir, 'claude-channel-mcp.json')
    const launchArgs = buildClaudeChannelLaunchArgs(filePath)
    if (!launchArgs) {
      continue
    }
    try {
      mkdirSync(dir, { recursive: true })
      writeFileSync(filePath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 })
      return launchArgs
    } catch (error) {
      console.warn('[telegram-channel] failed to write MCP config', error)
    }
  }
  return null
}
