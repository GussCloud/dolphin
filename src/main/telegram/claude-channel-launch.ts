/**
 * Opts a local Claude Code launch into Dolphin's channels (Telegram, and the orchestration channel
 * for goal coordinators) by splicing `--mcp-config=<file>` plus one
 * `--dangerously-load-development-channels=server:<name>` per channel after the `claude` token.
 * Anything this cannot do safely leaves the command untouched, which keeps the pane on its
 * terminal-typing fallback.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { hasReachedAppVersion } from '../../shared/app-version'
import { SETUP_AGENT_SEQUENCE_STARTUP_COMMAND_ENV } from '../../shared/setup-agent-sequencing'
import type { TelegramChannelAvailability } from '../../shared/telegram-bridge-state'
import { AUTONOMOUS_COORDINATOR_CHANNEL_ENV } from '../../shared/autonomous-coordinator-launch-env'
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

export type ClaudeChannelServerEntry = { name: string; entryPath: string }

export function buildClaudeChannelMcpConfig(args: {
  execPath: string
  servers: readonly ClaudeChannelServerEntry[]
}): ClaudeChannelMcpConfig {
  return {
    mcpServers: Object.fromEntries(
      args.servers.map((server) => [
        server.name,
        {
          type: 'stdio' as const,
          command: args.execPath,
          args: [server.entryPath],
          // Why: Dolphin's own Electron binary is the only Node runtime guaranteed on this host.
          env: { ELECTRON_RUN_AS_NODE: '1' }
        }
      ])
    )
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

/**
 * The argument suffix, or null when the config path cannot be written literally. One flag per
 * server: Claude Code accumulates repeated `=` occurrences into one channel list
 * (src/main/runtime/__fixtures__/claude-dev-channels-two-servers.txt).
 */
export function buildClaudeChannelLaunchArgs(
  mcpConfigPath: string,
  serverNames: readonly string[] = [DOLPHIN_TELEGRAM_CHANNEL_SERVER_NAME]
): string | null {
  const literal = shellLiteralConfigPath(mcpConfigPath)
  return literal && serverNames.length > 0
    ? [
        `--mcp-config=${literal}`,
        ...serverNames.map((name) => `--dangerously-load-development-channels=server:${name}`)
      ].join(' ')
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

/** Launch args for a goal coordinator: its channel alone, or together with Telegram's. */
export type CoordinatorChannelLaunchArgs = { alone: string; withTelegram: string | null }

export type CoordinatorChannelLaunchPolicy = {
  launchArgs(): CoordinatorChannelLaunchArgs | null
}

let activePolicy: ClaudeChannelLaunchPolicy | null = null
let activeCoordinatorPolicy: CoordinatorChannelLaunchPolicy | null = null

export function setClaudeChannelLaunchPolicy(policy: ClaudeChannelLaunchPolicy | null): void {
  activePolicy = policy
}

export function setCoordinatorChannelLaunchPolicy(
  policy: CoordinatorChannelLaunchPolicy | null
): void {
  activeCoordinatorPolicy = policy
}

/** The renderer marks a local goal coordinator launch; `claude` only, see deepseek-agent.md. */
function isCoordinatorChannelLaunch(target: ClaudeChannelLaunchTarget): boolean {
  return target.launchAgent === 'claude' && target.env?.[AUTONOMOUS_COORDINATOR_CHANNEL_ENV] === '1'
}

function resolveLaunchArgs(
  target: ClaudeChannelLaunchTarget,
  policy: ClaudeChannelLaunchPolicy | null,
  coordinatorPolicy: CoordinatorChannelLaunchPolicy | null
): { launchArgs: string; coordinator: boolean } | null {
  const telegramArgs = policy?.launchArgs() ?? null
  const coordinatorArgs = isCoordinatorChannelLaunch(target)
    ? (coordinatorPolicy?.launchArgs() ?? null)
    : null
  if (coordinatorArgs) {
    // Why alone when the combined config is missing: Telegram then keeps its terminal fallback.
    const launchArgs = telegramArgs
      ? (coordinatorArgs.withTelegram ?? coordinatorArgs.alone)
      : coordinatorArgs.alone
    return { launchArgs, coordinator: true }
  }
  return telegramArgs ? { launchArgs: telegramArgs, coordinator: false } : null
}

/**
 * Applied at PTY spawn. SSH and WSL panes are skipped: the channel server is Dolphin's local
 * Electron binary and talks to main over 127.0.0.1, which neither can reach.
 */
export function applyClaudeChannelLaunch(
  target: ClaudeChannelLaunchTarget,
  policy: ClaudeChannelLaunchPolicy | null = activePolicy,
  coordinatorPolicy: CoordinatorChannelLaunchPolicy | null = activeCoordinatorPolicy
): { command: string | undefined; env: Record<string, string> | undefined } {
  const unchanged = { command: target.command, env: target.env }
  if (target.launchAgent !== 'claude' || target.connectionId || target.isWsl) {
    return unchanged
  }
  const resolved = resolveLaunchArgs(target, policy, coordinatorPolicy)
  if (!resolved) {
    return unchanged
  }
  const { launchArgs } = resolved
  // Why only coordinators: their launch is unattended, and every listed server is Dolphin's own.
  const grant = { autoConfirmDevChannelsDialog: resolved.coordinator }
  const sequenced = target.env?.[SETUP_AGENT_SEQUENCE_STARTUP_COMMAND_ENV]
  if (target.env && sequenced) {
    // Why: the setup runner evals this env value, so the claude line lives here, not in command.
    const spliced = spliceClaudeChannelArgs(sequenced, launchArgs)
    if (spliced) {
      grantClaudeChannelPane(target.env, grant)
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
    grantClaudeChannelPane(target.env, grant)
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
export function createClaudeChannelLaunchPolicy<TArgs = string>(deps: {
  isEnabled: () => boolean
  /** Null when no local `claude` was found. */
  probeClaudeVersion: () => Promise<string | null>
  /** Writes the MCP config where its path is shell-literal and returns the launch args, or null. */
  writeMcpConfig: () => TArgs | null
  now?: () => number
  reprobeAfterMs?: number
}): Omit<ClaudeChannelLaunchPolicyHandle, 'launchArgs'> & { launchArgs(): TArgs | null } {
  const now = deps.now ?? Date.now
  const reprobeAfterMs = deps.reprobeAfterMs ?? 10 * 60_000
  let verdict: ProbedAvailability = 'checking'
  let configArgs: TArgs | null = null
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
  config: ClaudeChannelMcpConfig,
  fileName = 'claude-channel-mcp.json'
): string | null {
  for (const dir of candidateDirs) {
    const filePath = join(dir, fileName)
    const launchArgs = buildClaudeChannelLaunchArgs(filePath, Object.keys(config.mcpServers))
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
